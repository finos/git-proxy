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
import { Action, RequestType, Step } from '../../../src/proxy/actions/index.ts';
import { PullActionPlugin, PullPhase, isCompatiblePlugin } from '../../../src/plugin.ts';

const { parsePull, fetchWanted, resolveWants, rememberRecentFetch } = vi.hoisted(() => ({
  parsePull: vi.fn(),
  fetchWanted: vi.fn(),
  resolveWants: vi.fn(),
  rememberRecentFetch: vi.fn(),
}));

vi.mock('../../../plugins/git-proxy-plugin-samples/pullInspection/parsePull.ts', () => ({
  exec: parsePull,
}));
vi.mock('../../../plugins/git-proxy-plugin-samples/pullInspection/fetchWanted.ts', () => ({
  exec: fetchWanted,
  rememberRecentFetch,
}));
vi.mock('../../../plugins/git-proxy-plugin-samples/pullInspection/resolveWants.ts', () => ({
  exec: resolveWants,
}));

import plugin from '../../../plugins/git-proxy-plugin-samples/pullScanner/index.ts';

const makeAction = (): Action =>
  new Action(
    'action-1',
    RequestType.PULL,
    'POST',
    Date.now(),
    'https://github.com/example/repo.git',
  );

const req = { headers: {} } as Request;

const passingStep = (name: string) => async (_req: Request, action: Action) => {
  action.addStep(new Step(name));
  return action;
};

const failingStep = (name: string) => async (_req: Request, action: Action) => {
  const step = new Step(name);
  step.setError(`${name} failed`);
  action.addStep(step);
  return action;
};

describe('PullInspection plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parsePull.mockImplementation(passingStep('parsePull'));
    fetchWanted.mockImplementation(passingStep('fetchWanted'));
    resolveWants.mockImplementation(passingStep('resolveWants'));
  });

  it('is a pull action plugin running after authorisation', () => {
    expect(plugin).toBeInstanceOf(PullActionPlugin);
    expect(plugin.phase).toBe(PullPhase.AFTER_AUTHORISATION);
    expect(plugin.phase).toBe('AFTER_AUTHORISATION');
    expect(plugin.displayName).toBe('PullInspection');
    expect(isCompatiblePlugin(plugin, 'isGitProxyPullActionPlugin')).toBe(true);
  });

  it('runs parsePull, fetchWanted and resolveWants in order', async () => {
    const action = makeAction();

    const result = await plugin.exec(req, action);

    expect(result).toBe(action);
    expect(result.error).toBe(false);
    expect(result.steps.map((s) => s.stepName)).toEqual([
      'parsePull',
      'fetchWanted',
      'resolveWants',
    ]);
    expect(parsePull).toHaveBeenCalledWith(req, action);
    expect(fetchWanted).toHaveBeenCalledWith(req, action);
    expect(resolveWants).toHaveBeenCalledWith(req, action);
  });

  it('stops after parsePull sets an error', async () => {
    parsePull.mockImplementation(failingStep('parsePull'));

    const result = await plugin.exec(req, makeAction());

    expect(result.error).toBe(true);
    expect(result.errorMessage).toBe('parsePull failed');
    expect(result.steps.map((s) => s.stepName)).toEqual(['parsePull']);
    expect(fetchWanted).not.toHaveBeenCalled();
    expect(resolveWants).not.toHaveBeenCalled();
  });

  it('stops after fetchWanted sets an error', async () => {
    fetchWanted.mockImplementation(failingStep('fetchWanted'));

    const result = await plugin.exec(req, makeAction());

    expect(result.error).toBe(true);
    expect(result.steps.map((s) => s.stepName)).toEqual(['parsePull', 'fetchWanted']);
    expect(resolveWants).not.toHaveBeenCalled();
  });

  it('remembers the fetch on chain success', () => {
    const action = makeAction();

    plugin.onChainSuccess?.(req, action);

    expect(rememberRecentFetch).toHaveBeenCalledTimes(1);
    expect(rememberRecentFetch).toHaveBeenCalledWith(action);
  });
});
