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

import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { PluginLoader } from '../src/plugin';
import { Action, PushType, RequestType } from '../src/proxy/actions';

const mockLoader = {
  pushPlugins: [
    { exec: Object.assign(async () => console.log('foo'), { displayName: 'foo.exec' }) },
  ],
  pullPlugins: [
    { exec: Object.assign(async () => console.log('foo'), { displayName: 'bar.exec' }) },
  ],
};

const collectibleFn = () => Object.assign(vi.fn(), { isCollectible: true });
const nonCollectibleFn = () => Object.assign(vi.fn(), { isCollectible: false });

const initMockPushProcessors = () => {
  return {
    checkEmptyBranch: nonCollectibleFn(),
    checkRepoInAuthorisedList: nonCollectibleFn(),
    checkMessages: collectibleFn(),
    checkAuthorEmails: collectibleFn(),
    checkUserPushPermission: nonCollectibleFn(),
    resolveUserFromToken: nonCollectibleFn(),
    checkIfWaitingAuth: nonCollectibleFn(),
    checkHiddenCommits: nonCollectibleFn(),
    pullRemote: nonCollectibleFn(),
    writePack: nonCollectibleFn(),
    preReceive: collectibleFn(),
    getDiff: nonCollectibleFn(),
    gitleaks: collectibleFn(),
    clearBareClone: nonCollectibleFn(),
    scanDiff: collectibleFn(),
    blockForAuth: nonCollectibleFn(),
  };
};

const initMockPostProcessors = () => {
  return {
    audit: vi.fn(),
    clearBareClone: vi.fn(),
  };
};

const mockPreProcessors = {
  parseAction: vi.fn(),
  parsePush: vi.fn(),
};

describe('proxy chain', function () {
  let processors: any;
  let chain: any;
  let db: any;
  let mockPushProcessors: any;
  let mockPostProcessors: any;

  beforeEach(async () => {
    vi.resetModules();

    // Initialize the mocks
    mockPushProcessors = initMockPushProcessors();
    mockPostProcessors = initMockPostProcessors();

    // Mock the processors module
    vi.doMock('../src/proxy/processors', async () => ({
      pre: mockPreProcessors,
      push: mockPushProcessors,
      post: mockPostProcessors,
    }));

    vi.doMock('../src/db', async () => ({
      authorise: vi.fn(),
      reject: vi.fn(),
    }));

    // Import the mocked modules
    processors = await import('../src/proxy/processors');
    db = await import('../src/db');
    const chainModule = await import('../src/proxy/chain');
    chain = chainModule.default;

    chain.chainPluginLoader = new PluginLoader([]);

    //mock all processors as pass-through by default
    const passThroughImpl = (req: any, action: Action) => {
      return action;
    };
    Object.keys(mockPushProcessors).forEach((key) => {
      mockPushProcessors[key].mockImplementation(passThroughImpl);
    });
    Object.keys(mockPostProcessors).forEach((key) => {
      mockPostProcessors[key].mockImplementation(passThroughImpl);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('getChain should set pluginLoaded if loader is undefined', async () => {
    chain.chainPluginLoader = undefined;
    const actual = await chain.getChain({ type: 'push' });
    expect(actual).toEqual(chain.branchPushChain);
    expect(chain.chainPluginLoader).toBeUndefined();
    expect(chain.pluginsInserted).toBe(true);
  });

  it('getChain should load plugins from an initialized PluginLoader', async () => {
    chain.chainPluginLoader = mockLoader;
    const initialChain = [...chain.branchPushChain];
    const actual = await chain.getChain({ type: 'push' });
    expect(actual.length).toBeGreaterThan(initialChain.length);
    expect(chain.pluginsInserted).toBe(true);
  });

  it('getChain should load pull plugins from an initialized PluginLoader', async () => {
    chain.chainPluginLoader = mockLoader;
    const initialChain = [...chain.pullActionChain];
    const actual = await chain.getChain({ type: 'pull' });
    expect(actual.length).toBeGreaterThan(initialChain.length);
    expect(chain.pluginsInserted).toBe(true);
  });

  it('getChain should insert start-phase push plugins at the beginning of the chain', async () => {
    const startExec = Object.assign(async () => {}, { displayName: 'start.exec' });
    chain.chainPluginLoader = {
      pushPlugins: [{ exec: startExec }],
      pullPlugins: [],
    };
    const actual = await chain.getChain({ type: RequestType.PUSH, actionType: PushType.BRANCH });
    expect(actual[0]).toBe(startExec);
  });

  it('getChain should insert afterDiff push plugins immediately after getDiff', async () => {
    const afterDiffExec = Object.assign(async () => {}, { displayName: 'afterDiff.exec' });
    chain.chainPluginLoader = {
      pushPlugins: [{ exec: afterDiffExec, chainPhase: 'afterDiff' }],
      pullPlugins: [],
    };
    const actual = await chain.getChain({ type: RequestType.PUSH, actionType: PushType.BRANCH });
    const diffIndex = actual.indexOf(processors.push.getDiff);
    expect(diffIndex).toBeGreaterThan(-1);
    expect(actual[diffIndex + 1]).toBe(afterDiffExec);
    // afterDiff plugins must not be inserted at the very start of the chain
    expect(actual[0]).not.toBe(afterDiffExec);
  });

  it('getChain should preserve registration order for multiple afterDiff push plugins', async () => {
    const first = Object.assign(async () => {}, { displayName: 'first.exec' });
    const second = Object.assign(async () => {}, { displayName: 'second.exec' });
    chain.chainPluginLoader = {
      pushPlugins: [
        { exec: first, chainPhase: 'afterDiff' },
        { exec: second, chainPhase: 'afterDiff' },
      ],
      pullPlugins: [],
    };
    const actual = await chain.getChain({ type: RequestType.PUSH, actionType: PushType.BRANCH });
    const diffIndex = actual.indexOf(processors.push.getDiff);
    expect(actual[diffIndex + 1]).toBe(first);
    expect(actual[diffIndex + 2]).toBe(second);
  });

  it('getChain should insert afterAuth pull plugins after checkRepoInAuthorisedList', async () => {
    const afterAuthExec = Object.assign(async () => {}, { displayName: 'pullScan.exec' });
    chain.chainPluginLoader = {
      pushPlugins: [],
      pullPlugins: [{ exec: afterAuthExec, chainPhase: 'afterAuth' }],
    };
    const actual = await chain.getChain({ type: RequestType.PULL });
    const authIndex = actual.indexOf(processors.push.checkRepoInAuthorisedList);
    expect(authIndex).toBeGreaterThan(-1);
    expect(actual[authIndex + 1]).toBe(afterAuthExec);
    expect(actual[0]).not.toBe(afterAuthExec);
  });

  it('getChain should insert start-phase pull plugins before the auth check', async () => {
    const startExec = Object.assign(async () => {}, { displayName: 'pullStart.exec' });
    chain.chainPluginLoader = {
      pushPlugins: [],
      pullPlugins: [{ exec: startExec }],
    };
    const actual = await chain.getChain({ type: RequestType.PULL });
    expect(actual[0]).toBe(startExec);
  });

  it('getChain should run afterDiff push plugins on the tag chain before blockForAuth', async () => {
    const afterDiffExec = Object.assign(async () => {}, { displayName: 'afterDiff.exec' });
    chain.chainPluginLoader = {
      pushPlugins: [{ exec: afterDiffExec, chainPhase: 'afterDiff' }],
      pullPlugins: [],
    };
    const actual = await chain.getChain({ type: RequestType.PUSH, actionType: PushType.TAG });
    const blockIndex = actual.indexOf(processors.push.blockForAuth);
    expect(blockIndex).toBeGreaterThan(-1);
    expect(actual[blockIndex - 1]).toBe(afterDiffExec);
  });

  it('executeChain should stop executing if action has continue returns false', async () => {
    const req = {};
    const continuingAction = { type: 'push', continue: () => true, allowPush: false };
    const action = { type: 'push' } as Action;
    mockPreProcessors.parseAction.mockResolvedValue(action);

    mockPreProcessors.parsePush.mockResolvedValue(continuingAction);

    // this stops the chain from further execution
    mockPushProcessors.checkIfWaitingAuth.mockResolvedValue({
      type: 'push',
      continue: () => false,
      allowPush: false,
    });

    const result = await chain.executeChain(req);

    //all processors upto checkIfWaitingAuth should have run + clearBareClone & audit
    expect(mockPreProcessors.parseAction).toHaveBeenCalled();
    expect(mockPreProcessors.parsePush).toHaveBeenCalled();

    expect(mockPushProcessors.checkEmptyBranch).toHaveBeenCalled();
    expect(mockPushProcessors.checkRepoInAuthorisedList).toHaveBeenCalled();
    expect(mockPushProcessors.checkMessages).toHaveBeenCalled();
    expect(mockPushProcessors.checkAuthorEmails).toHaveBeenCalled();
    expect(mockPushProcessors.checkUserPushPermission).toHaveBeenCalled();
    expect(mockPushProcessors.pullRemote).toHaveBeenCalled();
    expect(mockPushProcessors.writePack).toHaveBeenCalled();
    expect(mockPushProcessors.checkHiddenCommits).toHaveBeenCalled();
    expect(mockPushProcessors.checkIfWaitingAuth).toHaveBeenCalled();

    expect(mockPushProcessors.preReceive).not.toHaveBeenCalled();
    expect(mockPushProcessors.getDiff).not.toHaveBeenCalled();
    expect(mockPushProcessors.gitleaks).not.toHaveBeenCalled();
    expect(mockPushProcessors.scanDiff).not.toHaveBeenCalled();
    expect(mockPushProcessors.blockForAuth).not.toHaveBeenCalled();

    expect(mockPostProcessors.audit).toHaveBeenCalled();
    expect(mockPostProcessors.clearBareClone).toHaveBeenCalled();

    expect(result.type).toBe('push');
    expect(result.allowPush).toBe(false);
    expect(result.continue).toBeTypeOf('function');
    expect(result.continue()).toBe(false);
  });

  it('executeChain should stop executing if action has allowPush is set to true', async () => {
    const req = {};
    const continuingAction = { type: 'push', continue: () => true, allowPush: false };
    const action = { type: 'push' } as Action;
    mockPreProcessors.parseAction.mockResolvedValue(action);

    mockPreProcessors.parsePush.mockResolvedValue(continuingAction);

    // this stops the chain from further execution
    mockPushProcessors.checkIfWaitingAuth.mockResolvedValue({
      type: 'push',
      continue: () => true,
      allowPush: true,
    });

    const result = await chain.executeChain(req);

    //all processors upto checkIfWaitingAuth should have run + clearBareClone & audit
    expect(mockPreProcessors.parseAction).toHaveBeenCalled();
    expect(mockPreProcessors.parsePush).toHaveBeenCalled();

    expect(mockPushProcessors.checkEmptyBranch).toHaveBeenCalled();
    expect(mockPushProcessors.checkRepoInAuthorisedList).toHaveBeenCalled();
    expect(mockPushProcessors.checkMessages).toHaveBeenCalled();
    expect(mockPushProcessors.checkAuthorEmails).toHaveBeenCalled();
    expect(mockPushProcessors.checkUserPushPermission).toHaveBeenCalled();
    expect(mockPushProcessors.pullRemote).toHaveBeenCalled();
    expect(mockPushProcessors.writePack).toHaveBeenCalled();
    expect(mockPushProcessors.checkHiddenCommits).toHaveBeenCalled();
    expect(mockPushProcessors.checkIfWaitingAuth).toHaveBeenCalled();

    expect(mockPushProcessors.preReceive).not.toHaveBeenCalled();
    expect(mockPushProcessors.getDiff).not.toHaveBeenCalled();
    expect(mockPushProcessors.gitleaks).not.toHaveBeenCalled();
    expect(mockPushProcessors.scanDiff).not.toHaveBeenCalled();
    expect(mockPushProcessors.blockForAuth).not.toHaveBeenCalled();

    expect(mockPostProcessors.audit).toHaveBeenCalled();
    expect(mockPostProcessors.clearBareClone).toHaveBeenCalled();

    expect(result.type).toBe('push');
    expect(result.allowPush).toBe(true);
    expect(result.continue).toBeTypeOf('function');
    expect(result.continue()).toBe(true);
  });

  it('executeChain should execute all steps if all actions succeed', async () => {
    const req = {};
    const continuingAction = { type: 'push', continue: () => true, allowPush: false };
    const action = { type: 'push' } as Action;
    mockPreProcessors.parseAction.mockResolvedValue(action);

    mockPreProcessors.parsePush.mockResolvedValue(continuingAction);

    const result = await chain.executeChain(req);

    //all processors should have run + clearBareClone & audit
    expect(mockPreProcessors.parseAction).toHaveBeenCalled();
    expect(mockPreProcessors.parsePush).toHaveBeenCalled();

    expect(mockPushProcessors.checkEmptyBranch).toHaveBeenCalled();
    expect(mockPushProcessors.checkRepoInAuthorisedList).toHaveBeenCalled();
    expect(mockPushProcessors.checkMessages).toHaveBeenCalled();
    expect(mockPushProcessors.checkAuthorEmails).toHaveBeenCalled();
    expect(mockPushProcessors.checkUserPushPermission).toHaveBeenCalled();
    expect(mockPushProcessors.pullRemote).toHaveBeenCalled();
    expect(mockPushProcessors.writePack).toHaveBeenCalled();
    expect(mockPushProcessors.checkHiddenCommits).toHaveBeenCalled();
    expect(mockPushProcessors.checkIfWaitingAuth).toHaveBeenCalled();
    expect(mockPushProcessors.preReceive).toHaveBeenCalled();
    expect(mockPushProcessors.getDiff).toHaveBeenCalled();
    expect(mockPushProcessors.gitleaks).toHaveBeenCalled();
    expect(mockPushProcessors.scanDiff).toHaveBeenCalled();
    expect(mockPushProcessors.blockForAuth).toHaveBeenCalled();

    expect(mockPostProcessors.audit).toHaveBeenCalled();
    expect(mockPostProcessors.clearBareClone).toHaveBeenCalled();

    expect(result.type).toBe('push');
    expect(result.allowPush).toBe(false);
    expect(result.continue).toBeTypeOf('function');
    expect(result.continue()).toBe(true);
  });

  it('executeChain should run the expected steps for pulls', async () => {
    const req = {};
    const continuingAction = { type: 'pull', continue: () => true, allowPush: false };
    mockPreProcessors.parseAction.mockResolvedValue({ type: 'pull' });
    mockPushProcessors.checkRepoInAuthorisedList.mockResolvedValue(continuingAction);

    const result = await chain.executeChain(req);

    expect(mockPushProcessors.checkRepoInAuthorisedList).toHaveBeenCalled();
    expect(mockPreProcessors.parsePush).not.toHaveBeenCalled();

    expect(mockPostProcessors.audit).toHaveBeenCalled();
    expect(mockPostProcessors.clearBareClone).not.toHaveBeenCalled();
    expect(result.type).toBe('pull');
  });

  it('executeChain should handle errors and still call audit', async () => {
    const req = {};
    const action = { type: 'push', continue: () => true, allowPush: false };

    processors.pre.parseAction.mockResolvedValue(action);
    processors.pre.parsePush.mockRejectedValue(new Error('Audit error'));

    try {
      await chain.executeChain(req);
    } catch {
      // Ignore the error
    }

    expect(mockPostProcessors.audit).toHaveBeenCalled();
  });

  it('executeChain should handle errors after pullRemote and still call clearBareClone', async () => {
    const req = {};
    const action = { type: 'push', continue: () => true, allowPush: false };

    processors.pre.parseAction.mockResolvedValue(action);
    processors.pre.parsePush.mockResolvedValue(action);
    mockPushProcessors.writePack.mockRejectedValue(new Error('writePack error'));

    try {
      await chain.executeChain(req);
    } catch {
      // Ignore the error
    }

    expect(mockPostProcessors.clearBareClone).toHaveBeenCalled();
  });

  it('executeChain should always run at least checkRepoInAuthList and audit', async () => {
    const req = {};
    const action = { type: 'foo', continue: () => true, allowPush: true };

    mockPreProcessors.parseAction.mockResolvedValue(action);
    mockPushProcessors.checkRepoInAuthorisedList.mockResolvedValue(action);

    await chain.executeChain(req);
    expect(mockPushProcessors.checkRepoInAuthorisedList).toHaveBeenCalled();
    expect(mockPostProcessors.audit).toHaveBeenCalled();
  });

  it('should approve push automatically and record in the database', async () => {
    const req = {};
    const action = {
      id: '123',
      type: 'push',
      continue: () => true,
      allowPush: false,
      setAutoApproval: vi.fn(),
      repoName: 'test-repo',
      commitTo: 'newCommitHash',
    };

    mockPreProcessors.parseAction.mockResolvedValue(action);
    mockPreProcessors.parsePush.mockResolvedValue(action);

    mockPushProcessors.preReceive.mockResolvedValue({
      ...action,
      steps: [{ error: false, logs: ['Push automatically approved by pre-receive hook.'] }],
      allowPush: true,
      autoApproved: true,
    });

    const dbSpy = vi.spyOn(db, 'authorise').mockResolvedValue({
      message: `authorised ${action.id}`,
    });

    const result = await chain.executeChain(req);

    expect(result.type).toBe('push');
    expect(result.allowPush).toBe(true);
    expect(result.continue).toBeTypeOf('function');
    expect(dbSpy).toHaveBeenCalledOnce();
  });

  it('should reject push automatically and record in the database', async () => {
    const req = {};
    const action = {
      id: '123',
      type: 'push',
      continue: () => true,
      allowPush: false,
      setAutoRejection: vi.fn(),
      repoName: 'test-repo',
      commitTo: 'newCommitHash',
    };

    mockPreProcessors.parseAction.mockResolvedValue(action);
    mockPreProcessors.parsePush.mockResolvedValue(action);

    mockPushProcessors.preReceive.mockResolvedValue({
      ...action,
      steps: [{ error: false, logs: ['Push automatically rejected by pre-receive hook.'] }],
      allowPush: true,
      autoRejected: true,
    });

    const dbSpy = vi.spyOn(db, 'reject').mockResolvedValue({
      message: `reject ${action.id}`,
    });

    const result = await chain.executeChain(req);

    expect(result.type).toBe('push');
    expect(result.allowPush).toBe(true);
    expect(result.continue).toBeTypeOf('function');
    expect(dbSpy).toHaveBeenCalledOnce();
  });

  it('executeChain should handle exceptions in attemptAutoApproval', async () => {
    const req = {};
    const action = {
      type: 'push',
      continue: () => true,
      allowPush: false,
      setAutoApproval: vi.fn(),
      repoName: 'test-repo',
      commitTo: 'newCommitHash',
    };

    mockPreProcessors.parseAction.mockResolvedValue(action);
    mockPreProcessors.parsePush.mockResolvedValue(action);

    mockPushProcessors.preReceive.mockResolvedValue({
      ...action,
      steps: [{ error: false, logs: ['Push automatically approved by pre-receive hook.'] }],
      allowPush: true,
      autoApproved: true,
    });

    const error = new Error('Database error');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'authorise').mockRejectedValue(error);

    await chain.executeChain(req);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error during auto-approval: Database error');
  });

  it('executeChain should handle exceptions in attemptAutoRejection', async () => {
    const req = {};
    const action = {
      type: 'push',
      continue: () => true,
      allowPush: false,
      setAutoRejection: vi.fn(),
      repoName: 'test-repo',
      commitTo: 'newCommitHash',
      autoRejected: true,
    };

    mockPreProcessors.parseAction.mockResolvedValue(action);
    mockPreProcessors.parsePush.mockResolvedValue(action);

    mockPushProcessors.preReceive.mockResolvedValue({
      ...action,
      steps: [{ error: false, logs: ['Push automatically rejected by pre-receive hook.'] }],
      allowPush: false,
      autoRejected: true,
    });

    const error = new Error('Database error');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'reject').mockRejectedValue(error);

    await chain.executeChain(req);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error during auto-rejection: Database error');
  });

  describe('error collection', () => {
    // simulates a real processor failing
    const failStep = (message: string) => async (req: any, action: any) => {
      action.steps = [...(action.steps ?? []), { error: true, errorMessage: message }];
      action.error = true;
      action.continue = () => false;
      return action;
    };

    const setupPushAction = () => {
      const action = {
        type: 'push',
        steps: [],
        continue: () => true,
        allowPush: false,
      };
      mockPreProcessors.parseAction.mockResolvedValue(action);
      mockPreProcessors.parsePush.mockResolvedValue(action);
      return action;
    };

    it('should continue past recoverable failures and run the remaining checks', async () => {
      setupPushAction();
      mockPushProcessors.checkMessages.mockImplementation(failStep('bad commit message'));

      const result = await chain.executeChain({});

      // all later steps still ran
      expect(mockPushProcessors.checkAuthorEmails).toHaveBeenCalled();
      expect(mockPushProcessors.checkUserPushPermission).toHaveBeenCalled();
      expect(mockPushProcessors.pullRemote).toHaveBeenCalled();
      expect(mockPushProcessors.writePack).toHaveBeenCalled();
      expect(mockPushProcessors.getDiff).toHaveBeenCalled();
      expect(mockPushProcessors.gitleaks).toHaveBeenCalled();
      expect(mockPushProcessors.scanDiff).toHaveBeenCalled();

      // but a failing push is never queued for approval
      expect(mockPushProcessors.blockForAuth).not.toHaveBeenCalled();
      expect(result.error).toBe(true);
    });

    it('should report every collected failure in a single combined message', async () => {
      setupPushAction();
      mockPushProcessors.checkMessages.mockImplementation(failStep('bad commit message'));
      mockPushProcessors.scanDiff.mockImplementation(failStep('secret detected in diff'));

      const result = await chain.executeChain({});

      expect(result.errorMessage).toContain('The following 2 checks failed:');
      expect(result.errorMessage).toContain('bad commit message');
      expect(result.errorMessage).toContain('secret detected in diff');
    });

    it('should keep the original message when only one collectible step fails', async () => {
      setupPushAction();
      mockPushProcessors.checkAuthorEmails.mockImplementation(failStep('illegal author email'));

      const result = await chain.executeChain({});

      expect(result.errorMessage).toBeUndefined(); // addStep is mocked so chain must not overwrite
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].errorMessage).toBe('illegal author email');
    });

    it('should still stop immediately when a fatal step fails', async () => {
      setupPushAction();
      mockPushProcessors.checkUserPushPermission.mockImplementation(failStep('no push permission'));

      await chain.executeChain({});

      expect(mockPushProcessors.pullRemote).not.toHaveBeenCalled();
      expect(mockPushProcessors.scanDiff).not.toHaveBeenCalled();
      expect(mockPushProcessors.blockForAuth).not.toHaveBeenCalled();
    });

    it('should not auto-approve a push that collected failures', async () => {
      setupPushAction();
      mockPushProcessors.checkMessages.mockImplementation(failStep('bad commit message'));
      mockPushProcessors.preReceive.mockImplementation(async (req: any, action: any) => {
        action.autoApproved = true;
        return action;
      });
      const dbSpy = vi.spyOn(db, 'authorise');

      await chain.executeChain({});

      expect(dbSpy).not.toHaveBeenCalled();
    });
  });

  it('returns pullActionChain for pull actions', async () => {
    const action = new Action(
      '1',
      RequestType.PULL,
      'GET',
      Date.now(),
      'http://github.com/owner/repo.git',
    );
    const pullChain = await chain.getChain(action);
    expect(pullChain).toEqual(chain.pullActionChain);
  });

  it('returns tagPushChain when action.type is push and action.actionType is TAG', async () => {
    const action = new Action(
      '2',
      RequestType.PUSH,
      'POST',
      Date.now(),
      'http://github.com/owner/repo.git',
    );
    action.actionType = PushType.TAG;
    const tagChain = await chain.getChain(action);
    expect(tagChain).toEqual(chain.tagPushChain);
  });

  it('returns branchPushChain when action.type is push and actionType is BRANCH', async () => {
    const action = new Action(
      '3',
      RequestType.PUSH,
      'POST',
      Date.now(),
      'http://github.com/owner/repo.git',
    );
    action.actionType = PushType.BRANCH;
    const branchChain = await chain.getChain(action);
    expect(branchChain).toEqual(chain.branchPushChain);
  });

  it('getChain should return tagPushChain if loader is undefined for tag pushes', async () => {
    chain.chainPluginLoader = undefined;
    const actual = await chain.getChain({ type: RequestType.PUSH, actionType: PushType.TAG });
    expect(actual).toEqual(chain.tagPushChain);
    expect(chain.chainPluginLoader).toBeUndefined();
    expect(chain.pluginsInserted).toBe(true);
  });

  it('getChain should load tag plugins from an initialized PluginLoader', async () => {
    chain.chainPluginLoader = mockLoader;
    const initialChain = [...chain.tagPushChain];
    const actual = await chain.getChain({ type: RequestType.PUSH, actionType: PushType.TAG });
    expect(actual.length).toBeGreaterThan(initialChain.length);
    expect(chain.pluginsInserted).toBe(true);
  });
});
