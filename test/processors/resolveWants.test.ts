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

import { describe, it, beforeEach, expect, vi } from 'vitest';
import { Request } from 'express';
import { Action, PullType, RequestType } from '../../src/proxy/actions';
import { PullData } from '../../src/types/models';

const { gitRaw } = vi.hoisted(() => ({
  gitRaw: vi.fn(),
}));

vi.mock('simple-git', () => ({
  default: () => ({ raw: gitRaw }),
}));

import { exec as resolveWants } from '../../src/proxy/processors/pull-action/resolveWants';

const WANT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const WANT2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const TAG_OID = 'cccccccccccccccccccccccccccccccccccccccc';

const fetchPull = (overrides: Partial<PullData> = {}): PullData => ({
  protocolVersion: 2,
  command: PullType.FETCH,
  capabilities: [],
  wants: [WANT],
  haves: [],
  wantRefs: [],
  refPrefixes: [],
  shallow: [],
  done: true,
  options: [],
  ...overrides,
});

const makeAction = (overrides: Partial<PullData> = {}): Action => {
  const action = new Action(
    'action-1',
    RequestType.PULL,
    'POST',
    Date.now(),
    'https://github.com/example/repo.git',
  );
  action.pullData = fetchPull(overrides);
  action.proxyGitPath = '/tmp/fake-checkout';
  return action;
};

const req = { headers: {} } as Request;

const stepLogs = (action: Action): string => action.steps[0].logs.join('\n');

describe('resolveWants processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gitRaw.mockResolvedValue('');
  });

  it('skips when no pullData', async () => {
    const action = makeAction();
    action.pullData = undefined;

    const result = await resolveWants(req, action);

    expect(gitRaw).not.toHaveBeenCalled();
    expect(stepLogs(result)).toContain('skipping');
    expect(result.error).toBe(false);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].stepName).toBe('resolveWants');
  });

  it('skips when command is ls-refs', async () => {
    const action = makeAction({ command: PullType.LS_REFS });

    const result = await resolveWants(req, action);

    expect(action.proxyGitPath).toBe('/tmp/fake-checkout');
    expect(gitRaw).not.toHaveBeenCalled();
    expect(stepLogs(result)).toContain('skipping');
    expect(result.error).toBe(false);
    expect(result.steps).toHaveLength(1);
  });

  it('skips when no proxyGitPath', async () => {
    const action = makeAction({ wants: [WANT] });
    action.proxyGitPath = undefined;

    const result = await resolveWants(req, action);

    expect(gitRaw).not.toHaveBeenCalled();
    expect(stepLogs(result)).toContain('skipping');
    expect(result.error).toBe(false);
    expect(result.steps).toHaveLength(1);
  });

  it('maps a want OID to a branch and sets action.branch', async () => {
    gitRaw.mockResolvedValue(`${WANT}\trefs/heads/main\n`);
    const action = makeAction({ wants: [WANT] });

    const result = await resolveWants(req, action);

    expect(result.pullData?.wantedRefs).toContain('refs/heads/main');
    expect(result.branch).toBe('refs/heads/main');
    expect(gitRaw).toHaveBeenCalledWith(['ls-remote', '--heads', '--tags', 'origin']);
    expect(result.error).toBe(false);
    expect(stepLogs(result)).toContain('resolveWants - Requested refs: refs/heads/main');
  });

  it('prefers fetchedWants over wants', async () => {
    gitRaw.mockResolvedValue(`${WANT}\trefs/heads/main\n`);
    const action = makeAction({ wants: [WANT2], fetchedWants: [WANT] });

    const result = await resolveWants(req, action);

    expect(result.pullData?.wantedRefs).toEqual(['refs/heads/main']);
    expect(result.pullData?.wantedRefs).not.toContain(WANT2);
    expect(result.branch).toBe('refs/heads/main');
  });

  it('uses an unmapped OID as its own wantedRefs key', async () => {
    const action = makeAction({ wants: [WANT] });

    const result = await resolveWants(req, action);

    expect(result.pullData?.wantedRefs).toContain(WANT);
    expect(result.branch).toBeUndefined();
    expect(result.tags).toBeUndefined();
  });

  it('seeds wantRefs even if they are not in ls-remote', async () => {
    const action = makeAction({ wantRefs: ['refs/heads/feature'], wants: [] });

    const result = await resolveWants(req, action);

    expect(result.pullData?.wantedRefs).toContain('refs/heads/feature');
    expect(gitRaw).toHaveBeenCalled();
  });

  it('maps a tag OID and ignores peeled ^{} advertisement lines', async () => {
    gitRaw.mockResolvedValue(`${TAG_OID}\trefs/tags/v1.0\n${WANT}\trefs/tags/v1.0^{}\n`);
    const action = makeAction({ wants: [TAG_OID] });

    const result = await resolveWants(req, action);

    expect(result.pullData?.wantedRefs).toContain('refs/tags/v1.0');
    expect(result.pullData?.wantedRefs).not.toContain(WANT);
    expect(result.tags).toEqual(['refs/tags/v1.0']);
  });

  it('treats a peeled tag commit as an unmapped OID', async () => {
    gitRaw.mockResolvedValue(`${TAG_OID}\trefs/tags/v1.0\n${WANT}\trefs/tags/v1.0^{}\n`);
    const action = makeAction({ wants: [WANT] });

    const result = await resolveWants(req, action);

    expect(result.pullData?.wantedRefs).toContain(WANT);
    expect(result.pullData?.wantedRefs).not.toContain('refs/tags/v1.0');
    expect(result.tags).toBeUndefined();
  });

  it('does not set action.branch when multiple heads are requested', async () => {
    gitRaw.mockResolvedValue(`${WANT}\trefs/heads/main\n${WANT2}\trefs/heads/develop\n`);
    const action = makeAction({ wants: [WANT, WANT2] });

    const result = await resolveWants(req, action);

    expect(result.pullData?.wantedRefs).toEqual(['refs/heads/main', 'refs/heads/develop']);
    expect(result.branch).toBeUndefined();
  });

  it('sets action.tags when any tags are present', async () => {
    gitRaw.mockResolvedValue(`${WANT}\trefs/tags/v1.0\n`);
    const action = makeAction({ wants: [WANT] });

    const result = await resolveWants(req, action);

    expect(result.tags).toEqual(['refs/tags/v1.0']);
    expect(result.branch).toBeUndefined();
  });

  it('sets both branch and tags when one head and tags are present', async () => {
    gitRaw.mockResolvedValue(`${WANT}\trefs/heads/main\n${TAG_OID}\trefs/tags/v1.0\n`);
    const action = makeAction({ wants: [WANT, TAG_OID] });

    const result = await resolveWants(req, action);

    expect(result.branch).toBe('refs/heads/main');
    expect(result.tags).toEqual(['refs/tags/v1.0']);
    expect(result.pullData?.wantedRefs).toEqual(['refs/heads/main', 'refs/tags/v1.0']);
  });

  it('logs ls-remote failures without setting an error', async () => {
    gitRaw.mockRejectedValue(new Error('network down'));
    const action = makeAction();

    const result = await resolveWants(req, action);

    expect(result.error).toBe(false);
    expect(result.steps[0].error).toBe(false);
    expect(stepLogs(result)).toContain('Could not resolve wants to refs');
    expect(stepLogs(result)).toContain('network down');
    expect(result.pullData?.wantedRefs).toBeUndefined();
  });

  it('skips empty and whitespace ls-remote lines', async () => {
    gitRaw.mockResolvedValue(`\n  \n${WANT}\trefs/heads/main\n\n`);
    const action = makeAction({ wants: [WANT] });

    const result = await resolveWants(req, action);

    expect(result.pullData?.wantedRefs).toEqual(['refs/heads/main']);
    expect(result.branch).toBe('refs/heads/main');
  });

  it('always returns the same action instance', async () => {
    const successAction = makeAction();
    gitRaw.mockResolvedValue(`${WANT}\trefs/heads/main\n`);
    expect(await resolveWants(req, successAction)).toBe(successAction);

    const skipAction = makeAction();
    skipAction.pullData = undefined;
    expect(await resolveWants(req, skipAction)).toBe(skipAction);
  });

  it('sets displayName to resolveWants.exec', () => {
    expect(resolveWants.displayName).toBe('resolveWants.exec');
  });

  it('sets step.content to { wantedRefs } on success', async () => {
    gitRaw.mockResolvedValue(`${WANT}\trefs/heads/main\n`);
    const action = makeAction({ wants: [WANT] });

    const result = await resolveWants(req, action);

    expect(result.steps[0].content).toEqual({ wantedRefs: ['refs/heads/main'] });
  });

  it('still adds a step when skipping', async () => {
    const action = makeAction();
    action.pullData = undefined;

    const result = await resolveWants(req, action);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].stepName).toBe('resolveWants');
    expect(gitRaw).not.toHaveBeenCalled();
  });
});
