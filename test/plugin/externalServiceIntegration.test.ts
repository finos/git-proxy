/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request } from 'express';

import { Action, RequestType, Step } from '../../src/proxy/actions';
import { isCompatiblePlugin, PushActionPlugin, PushPhase } from '../../src/plugin';

vi.mock('@finos/git-proxy/plugin', async () => await import('../../src/plugin'));
vi.mock('@finos/git-proxy/proxy/actions', async () => await import('../../src/proxy/actions'));

const SAMPLE = '../../plugins/git-proxy-plugin-samples/externalServiceIntegration.ts';

const TIMEOUT_MS = 5 * 60 * 1000;
const SHORT_SCAN_MS = 2000; // shortest delay the mock DLP service produces
const LONG_SCAN_MS = 330000; // a "long" mock scan that outlives the plugin timeout

/**
 * Pin the mock DLP service's random draws: verdict, (rejection reason), delay bucket, delay.
 * @param {number[]} draws values returned by successive Math.random() calls
 */
const pinRandom = (...draws: number[]) => {
  vi.spyOn(Math, 'random').mockImplementation(() => draws.shift() ?? 0);
};
const approveAfter2s = () => pinRandom(0, 0, 0);
const rejectAfter2s = () => pinRandom(0.9, 0, 0, 0);
const approveAfterLongScan = () => pinRandom(0, 0.9, 0.5);

type TestRequest = Request & { isSSH?: boolean; sshClient?: { disconnected?: boolean } };

const httpRequest = () => ({ socket: { destroyed: false } }) as unknown as TestRequest;
const sshRequest = () => ({ isSSH: true, sshClient: { disconnected: false } }) as TestRequest;

const SAMPLE_DIFF = 'diff --git a/x b/x\n+secret\n';

const newAction = () =>
  new Action('push-1', RequestType.PUSH, 'POST', Date.now(), 'https://example.com/o/r.git');

const pushAction = () => {
  const action = newAction();
  action.setDiff(SAMPLE_DIFF);
  return action;
};

const withoutDiff = newAction;

const lastStep = (action: Action): Step => action.steps[action.steps.length - 1];

describe('ExternalServiceIntegration sample plugin', () => {
  let plugin: PushActionPlugin;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    // fresh mock DLP service state (pending scans) for every test
    vi.resetModules();
    plugin = (await import(SAMPLE)).default;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is exported as a collectible AFTER_DIFF plugin on the branch chain only', () => {
    // the same check the plugin loader applies (module instances differ after resetModules)
    expect(isCompatiblePlugin(plugin, 'isGitProxyPushActionPlugin')).toBe(true);
    expect(plugin.phase).toBe(PushPhase.AFTER_DIFF);
    expect(plugin.chains).toEqual(['branch']);
    expect(plugin.isCollectible).toBe(true);
    expect(plugin.displayName).toBe('ExternalServiceIntegration');
  });

  it('lets the push continue when the DLP service approves it', async () => {
    approveAfter2s();
    const pending = plugin.exec(httpRequest(), pushAction());

    await vi.advanceTimersByTimeAsync(SHORT_SCAN_MS);
    const action = await pending;

    expect(action.error).toBe(false);
    const step = lastStep(action);
    expect(step.stepName).toBe('ExternalServiceIntegration');
    expect(step.error).toBe(false);
    expect(step.logs.join('\n')).toMatch(/Submitted DLP scan dlp-push-1-\d+, \d+ bytes/);
    expect(step.logs.join('\n')).toMatch(/DLP scan approved push push-1 after 2000ms/);
  });

  it('fails the step when the DLP service rejects the push', async () => {
    rejectAfter2s();
    const pending = plugin.exec(httpRequest(), pushAction());

    await vi.advanceTimersByTimeAsync(SHORT_SCAN_MS);
    const action = await pending;

    // an error is what stops a pre-receive auto-approval from being recorded for this push
    expect(action.error).toBe(true);
    expect(lastStep(action).errorMessage).toMatch(
      /DLP scan blocked push push-1 after 2000ms: Contains sensitive data/,
    );
  });

  it('fails the step with a retry hint when the scan outlives the timeout', async () => {
    approveAfterLongScan();
    const pending = plugin.exec(httpRequest(), pushAction());

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    const action = await pending;

    expect(action.error).toBe(true);
    expect(lastStep(action).errorMessage).toMatch(
      new RegExp(`still running after ${TIMEOUT_MS}ms\\. Run "git push" again`),
    );
  });

  it('reattaches the next push to a scan that timed out and reports its verdict', async () => {
    approveAfterLongScan();
    const first = plugin.exec(httpRequest(), pushAction());
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    expect((await first).error).toBe(true);

    await vi.advanceTimersByTimeAsync(LONG_SCAN_MS - TIMEOUT_MS);
    const second = await plugin.exec(httpRequest(), pushAction());

    expect(second.error).toBe(false);
    expect(lastStep(second).logs.join('\n')).toMatch(/Reattached to existing DLP scan dlp-push-1-/);
    expect(lastStep(second).logs.join('\n')).toMatch(/DLP scan approved push push-1/);
    expect(Math.random).toHaveBeenCalledTimes(3); // no new scan was submitted
  });

  it('starts a new scan once a completed scan has been acknowledged', async () => {
    approveAfter2s();
    const first = plugin.exec(httpRequest(), pushAction());
    await vi.advanceTimersByTimeAsync(SHORT_SCAN_MS);
    await first;

    const second = plugin.exec(httpRequest(), pushAction());
    await vi.advanceTimersByTimeAsync(SHORT_SCAN_MS);

    const logs = lastStep(await second).logs.join('\n');
    expect(logs).toMatch(/Submitted DLP scan/);
    expect(logs).not.toMatch(/Reattached/);
  });

  it('fails the step when the HTTP client disconnects while waiting', async () => {
    approveAfter2s();
    const req = httpRequest();
    const pending = plugin.exec(req, pushAction());

    await vi.advanceTimersByTimeAsync(500);
    (req.socket as { destroyed: boolean }).destroyed = true;
    await vi.advanceTimersByTimeAsync(1000);
    const action = await pending;

    // without an error the chain would go on to record the pre-receive auto-approval
    // for a push the DLP service never cleared
    expect(action.error).toBe(true);
    expect(lastStep(action).errorMessage).toMatch(
      /Client disconnected before the DLP scan completed\. Run "git push" again/,
    );
  });

  it('keeps the scan running after a disconnect and reattaches it on the next push', async () => {
    rejectAfter2s();
    const req = httpRequest();
    const first = plugin.exec(req, pushAction());
    await vi.advanceTimersByTimeAsync(500);
    (req.socket as { destroyed: boolean }).destroyed = true;
    await vi.advanceTimersByTimeAsync(1000);
    await first;

    const second = plugin.exec(httpRequest(), pushAction());
    await vi.advanceTimersByTimeAsync(SHORT_SCAN_MS);
    const action = await second;

    expect(lastStep(action).logs.join('\n')).toMatch(/Reattached to existing DLP scan/);
    expect(action.error).toBe(true);
    expect(lastStep(action).errorMessage).toMatch(/Contains sensitive data/);
  });

  it('detects SSH disconnects from the session flag', async () => {
    approveAfter2s();
    const req = sshRequest();
    const pending = plugin.exec(req, pushAction());

    await vi.advanceTimersByTimeAsync(500);
    req.sshClient!.disconnected = true;
    await vi.advanceTimersByTimeAsync(1000);

    expect((await pending).error).toBe(true);
    expect(lastStep(await pending).errorMessage).toMatch(/Client disconnected/);
  });

  it('does not treat an SSH push without an HTTP socket as disconnected', async () => {
    approveAfter2s();
    const pending = plugin.exec(sshRequest(), pushAction());

    await vi.advanceTimersByTimeAsync(SHORT_SCAN_MS);

    expect((await pending).error).toBe(false);
  });

  it('falls back to the diff step content when action.diff is not set', async () => {
    approveAfter2s();
    const action = withoutDiff();
    action.addStep(new Step('diff', false, null, false, null, 'abc'));

    const pending = plugin.exec(httpRequest(), action);
    await vi.advanceTimersByTimeAsync(SHORT_SCAN_MS);

    expect(lastStep(await pending).logs.join('\n')).toMatch(/Submitted DLP scan .*, 3 bytes/);
  });

  it('submits an empty scan when the push has no diff', async () => {
    approveAfter2s();
    const pending = plugin.exec(httpRequest(), withoutDiff());
    await vi.advanceTimersByTimeAsync(SHORT_SCAN_MS);
    const logs = lastStep(await pending).logs.join('\n');

    expect(logs).toMatch(/No diff found/);
    expect(logs).toMatch(/Submitted DLP scan .*, 0 bytes/);
  });

  it('clears its timeout and disconnect poll once the wait is over', async () => {
    approveAfter2s();
    const pending = plugin.exec(httpRequest(), pushAction());
    await vi.advanceTimersByTimeAsync(SHORT_SCAN_MS);
    await pending;

    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves only the running scan scheduled after a disconnect', async () => {
    approveAfter2s();
    const req = httpRequest();
    const pending = plugin.exec(req, pushAction());
    await vi.advanceTimersByTimeAsync(500);
    (req.socket as { destroyed: boolean }).destroyed = true;
    await vi.advanceTimersByTimeAsync(1000);
    await pending;

    expect(vi.getTimerCount()).toBe(1);
  });
});
