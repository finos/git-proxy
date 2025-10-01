import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { PluginLoader } from '../src/plugin';

const mockLoader = {
  pushPlugins: [
    { exec: Object.assign(async () => console.log('foo'), { displayName: 'foo.exec' }) },
  ],
  pullPlugins: [
    { exec: Object.assign(async () => console.log('foo'), { displayName: 'bar.exec' }) },
  ],
};

const initMockPushProcessors = () => {
  const mockPushProcessors = {
    parsePush: vi.fn(),
    checkEmptyBranch: vi.fn(),
    audit: vi.fn(),
    checkRepoInAuthorisedList: vi.fn(),
    checkCommitMessages: vi.fn(),
    checkAuthorEmails: vi.fn(),
    checkUserPushPermission: vi.fn(),
    checkIfWaitingAuth: vi.fn(),
    checkHiddenCommits: vi.fn(),
    pullRemote: vi.fn(),
    writePack: vi.fn(),
    preReceive: vi.fn(),
    getDiff: vi.fn(),
    gitleaks: vi.fn(),
    clearBareClone: vi.fn(),
    scanDiff: vi.fn(),
    blockForAuth: vi.fn(),
  };
  return mockPushProcessors;
};

const mockPreProcessors = {
  parseAction: vi.fn(),
};

describe('proxy chain', function () {
  let processors: any;
  let chain: any;
  let db: any;
  let mockPushProcessors: any;

  beforeEach(async () => {
    vi.resetModules();

    // Initialize the mocks
    mockPushProcessors = initMockPushProcessors();

    // Mock the processors module
    vi.doMock('../src/proxy/processors', async () => ({
      pre: mockPreProcessors,
      push: mockPushProcessors,
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('getChain should set pluginLoaded if loader is undefined', async () => {
    chain.chainPluginLoader = undefined;
    const actual = await chain.getChain({ type: 'push' });
    expect(actual).toEqual(chain.pushActionChain);
    expect(chain.chainPluginLoader).toBeUndefined();
    expect(chain.pluginsInserted).toBe(true);
  });

  it('getChain should load plugins from an initialized PluginLoader', async () => {
    chain.chainPluginLoader = mockLoader;
    const initialChain = [...chain.pushActionChain];
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

  it('executeChain should stop executing if action has continue returns false', async () => {
    const req = {};
    const continuingAction = { type: 'push', continue: () => true, allowPush: false };
    mockPreProcessors.parseAction.mockResolvedValue({ type: 'push' });
    mockPushProcessors.parsePush.mockResolvedValue(continuingAction);
    mockPushProcessors.checkEmptyBranch.mockResolvedValue(continuingAction);
    mockPushProcessors.checkRepoInAuthorisedList.mockResolvedValue(continuingAction);
    mockPushProcessors.checkCommitMessages.mockResolvedValue(continuingAction);
    mockPushProcessors.checkAuthorEmails.mockResolvedValue(continuingAction);
    mockPushProcessors.checkUserPushPermission.mockResolvedValue(continuingAction);
    mockPushProcessors.checkHiddenCommits.mockResolvedValue(continuingAction);
    mockPushProcessors.pullRemote.mockResolvedValue(continuingAction);
    mockPushProcessors.writePack.mockResolvedValue(continuingAction);
    // this stops the chain from further execution
    mockPushProcessors.checkIfWaitingAuth.mockResolvedValue({
      type: 'push',
      continue: () => false,
      allowPush: false,
    });

    const result = await chain.executeChain(req);

    expect(mockPreProcessors.parseAction).toHaveBeenCalled();
    expect(mockPushProcessors.parsePush).toHaveBeenCalled();
    expect(mockPushProcessors.checkRepoInAuthorisedList).toHaveBeenCalled();
    expect(mockPushProcessors.checkCommitMessages).toHaveBeenCalled();
    expect(mockPushProcessors.checkAuthorEmails).toHaveBeenCalled();
    expect(mockPushProcessors.checkUserPushPermission).toHaveBeenCalled();
    expect(mockPushProcessors.checkIfWaitingAuth).toHaveBeenCalled();
    expect(mockPushProcessors.pullRemote).toHaveBeenCalled();
    expect(mockPushProcessors.checkHiddenCommits).toHaveBeenCalled();
    expect(mockPushProcessors.writePack).toHaveBeenCalled();
    expect(mockPushProcessors.checkEmptyBranch).toHaveBeenCalled();
    expect(mockPushProcessors.audit).toHaveBeenCalled();

    expect(result.type).toBe('push');
    expect(result.allowPush).toBe(false);
    expect(result.continue).toBeTypeOf('function');
  });

  it('executeChain should stop executing if action has allowPush is set to true', async () => {
    const req = {};
    const continuingAction = { type: 'push', continue: () => true, allowPush: false };
    mockPreProcessors.parseAction.mockResolvedValue({ type: 'push' });
    mockPushProcessors.parsePush.mockResolvedValue(continuingAction);
    mockPushProcessors.checkEmptyBranch.mockResolvedValue(continuingAction);
    mockPushProcessors.checkRepoInAuthorisedList.mockResolvedValue(continuingAction);
    mockPushProcessors.checkCommitMessages.mockResolvedValue(continuingAction);
    mockPushProcessors.checkAuthorEmails.mockResolvedValue(continuingAction);
    mockPushProcessors.checkUserPushPermission.mockResolvedValue(continuingAction);
    mockPushProcessors.checkHiddenCommits.mockResolvedValue(continuingAction);
    mockPushProcessors.pullRemote.mockResolvedValue(continuingAction);
    mockPushProcessors.writePack.mockResolvedValue(continuingAction);
    // this stops the chain from further execution
    mockPushProcessors.checkIfWaitingAuth.mockResolvedValue({
      type: 'push',
      continue: () => true,
      allowPush: true,
    });

    const result = await chain.executeChain(req);

    expect(mockPreProcessors.parseAction).toHaveBeenCalled();
    expect(mockPushProcessors.parsePush).toHaveBeenCalled();
    expect(mockPushProcessors.checkEmptyBranch).toHaveBeenCalled();
    expect(mockPushProcessors.checkRepoInAuthorisedList).toHaveBeenCalled();
    expect(mockPushProcessors.checkCommitMessages).toHaveBeenCalled();
    expect(mockPushProcessors.checkAuthorEmails).toHaveBeenCalled();
    expect(mockPushProcessors.checkUserPushPermission).toHaveBeenCalled();
    expect(mockPushProcessors.checkIfWaitingAuth).toHaveBeenCalled();
    expect(mockPushProcessors.pullRemote).toHaveBeenCalled();
    expect(mockPushProcessors.checkHiddenCommits).toHaveBeenCalled();
    expect(mockPushProcessors.writePack).toHaveBeenCalled();
    expect(mockPushProcessors.audit).toHaveBeenCalled();

    expect(result.type).toBe('push');
    expect(result.allowPush).toBe(true);
    expect(result.continue).toBeTypeOf('function');
  });

  it('executeChain should execute all steps if all actions succeed', async () => {
    const req = {};
    const continuingAction = { type: 'push', continue: () => true, allowPush: false };
    mockPreProcessors.parseAction.mockResolvedValue({ type: 'push' });
    mockPushProcessors.parsePush.mockResolvedValue(continuingAction);
    mockPushProcessors.checkEmptyBranch.mockResolvedValue(continuingAction);
    mockPushProcessors.checkRepoInAuthorisedList.mockResolvedValue(continuingAction);
    mockPushProcessors.checkCommitMessages.mockResolvedValue(continuingAction);
    mockPushProcessors.checkAuthorEmails.mockResolvedValue(continuingAction);
    mockPushProcessors.checkUserPushPermission.mockResolvedValue(continuingAction);
    mockPushProcessors.checkIfWaitingAuth.mockResolvedValue(continuingAction);
    mockPushProcessors.pullRemote.mockResolvedValue(continuingAction);
    mockPushProcessors.writePack.mockResolvedValue(continuingAction);
    mockPushProcessors.checkHiddenCommits.mockResolvedValue(continuingAction);
    mockPushProcessors.preReceive.mockResolvedValue(continuingAction);
    mockPushProcessors.getDiff.mockResolvedValue(continuingAction);
    mockPushProcessors.gitleaks.mockResolvedValue(continuingAction);
    mockPushProcessors.clearBareClone.mockResolvedValue(continuingAction);
    mockPushProcessors.scanDiff.mockResolvedValue(continuingAction);
    mockPushProcessors.blockForAuth.mockResolvedValue(continuingAction);

    const result = await chain.executeChain(req);

    expect(mockPreProcessors.parseAction).toHaveBeenCalled();
    expect(mockPushProcessors.parsePush).toHaveBeenCalled();
    expect(mockPushProcessors.checkEmptyBranch).toHaveBeenCalled();
    expect(mockPushProcessors.checkRepoInAuthorisedList).toHaveBeenCalled();
    expect(mockPushProcessors.checkCommitMessages).toHaveBeenCalled();
    expect(mockPushProcessors.checkAuthorEmails).toHaveBeenCalled();
    expect(mockPushProcessors.checkUserPushPermission).toHaveBeenCalled();
    expect(mockPushProcessors.checkIfWaitingAuth).toHaveBeenCalled();
    expect(mockPushProcessors.pullRemote).toHaveBeenCalled();
    expect(mockPushProcessors.checkHiddenCommits).toHaveBeenCalled();
    expect(mockPushProcessors.writePack).toHaveBeenCalled();
    expect(mockPushProcessors.preReceive).toHaveBeenCalled();
    expect(mockPushProcessors.getDiff).toHaveBeenCalled();
    expect(mockPushProcessors.gitleaks).toHaveBeenCalled();
    expect(mockPushProcessors.clearBareClone).toHaveBeenCalled();
    expect(mockPushProcessors.scanDiff).toHaveBeenCalled();
    expect(mockPushProcessors.blockForAuth).toHaveBeenCalled();
    expect(mockPushProcessors.audit).toHaveBeenCalled();

    expect(result.type).toBe('push');
    expect(result.allowPush).toBe(false);
    expect(result.continue).toBeTypeOf('function');
  });

  it('executeChain should run the expected steps for pulls', async () => {
    const req = {};
    const continuingAction = { type: 'pull', continue: () => true, allowPush: false };
    mockPreProcessors.parseAction.mockResolvedValue({ type: 'pull' });
    mockPushProcessors.checkRepoInAuthorisedList.mockResolvedValue(continuingAction);

    const result = await chain.executeChain(req);

    expect(mockPushProcessors.checkRepoInAuthorisedList).toHaveBeenCalled();
    expect(mockPushProcessors.parsePush).not.toHaveBeenCalled();
    expect(result.type).toBe('pull');
  });

  it('executeChain should handle errors and still call audit', async () => {
    const req = {};
    const action = { type: 'push', continue: () => true, allowPush: true };

    processors.pre.parseAction.mockResolvedValue(action);
    mockPushProcessors.parsePush.mockRejectedValue(new Error('Audit error'));

    try {
      await chain.executeChain(req);
    } catch {
      // Ignore the error
    }

    expect(mockPushProcessors.audit).toHaveBeenCalled();
  });

  it('executeChain should always run at least checkRepoInAuthList', async () => {
    const req = {};
    const action = { type: 'foo', continue: () => true, allowPush: true };

    mockPreProcessors.parseAction.mockResolvedValue(action);
    mockPushProcessors.checkRepoInAuthorisedList.mockResolvedValue(action);

    await chain.executeChain(req);
    expect(mockPushProcessors.checkRepoInAuthorisedList).toHaveBeenCalled();
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
    mockPushProcessors.parsePush.mockResolvedValue(action);
    mockPushProcessors.checkEmptyBranch.mockResolvedValue(action);
    mockPushProcessors.checkRepoInAuthorisedList.mockResolvedValue(action);
    mockPushProcessors.checkCommitMessages.mockResolvedValue(action);
    mockPushProcessors.checkAuthorEmails.mockResolvedValue(action);
    mockPushProcessors.checkUserPushPermission.mockResolvedValue(action);
    mockPushProcessors.checkIfWaitingAuth.mockResolvedValue(action);
    mockPushProcessors.pullRemote.mockResolvedValue(action);
    mockPushProcessors.writePack.mockResolvedValue(action);
    mockPushProcessors.checkHiddenCommits.mockResolvedValue(action);

    mockPushProcessors.preReceive.mockResolvedValue({
      ...action,
      steps: [{ error: false, logs: ['Push automatically approved by pre-receive hook.'] }],
      allowPush: true,
      autoApproved: true,
    });

    mockPushProcessors.getDiff.mockResolvedValue(action);
    mockPushProcessors.gitleaks.mockResolvedValue(action);
    mockPushProcessors.clearBareClone.mockResolvedValue(action);
    mockPushProcessors.scanDiff.mockResolvedValue(action);
    mockPushProcessors.blockForAuth.mockResolvedValue(action);

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
    mockPushProcessors.parsePush.mockResolvedValue(action);
    mockPushProcessors.checkEmptyBranch.mockResolvedValue(action);
    mockPushProcessors.checkRepoInAuthorisedList.mockResolvedValue(action);
    mockPushProcessors.checkCommitMessages.mockResolvedValue(action);
    mockPushProcessors.checkAuthorEmails.mockResolvedValue(action);
    mockPushProcessors.checkUserPushPermission.mockResolvedValue(action);
    mockPushProcessors.checkIfWaitingAuth.mockResolvedValue(action);
    mockPushProcessors.pullRemote.mockResolvedValue(action);
    mockPushProcessors.writePack.mockResolvedValue(action);
    mockPushProcessors.checkHiddenCommits.mockResolvedValue(action);

    mockPushProcessors.preReceive.mockResolvedValue({
      ...action,
      steps: [{ error: false, logs: ['Push automatically rejected by pre-receive hook.'] }],
      allowPush: true,
      autoRejected: true,
    });

    mockPushProcessors.getDiff.mockResolvedValue(action);
    mockPushProcessors.gitleaks.mockResolvedValue(action);
    mockPushProcessors.clearBareClone.mockResolvedValue(action);
    mockPushProcessors.scanDiff.mockResolvedValue(action);
    mockPushProcessors.blockForAuth.mockResolvedValue(action);

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
    mockPushProcessors.parsePush.mockResolvedValue(action);
    mockPushProcessors.checkEmptyBranch.mockResolvedValue(action);
    mockPushProcessors.checkRepoInAuthorisedList.mockResolvedValue(action);
    mockPushProcessors.checkCommitMessages.mockResolvedValue(action);
    mockPushProcessors.checkAuthorEmails.mockResolvedValue(action);
    mockPushProcessors.checkUserPushPermission.mockResolvedValue(action);
    mockPushProcessors.checkIfWaitingAuth.mockResolvedValue(action);
    mockPushProcessors.pullRemote.mockResolvedValue(action);
    mockPushProcessors.writePack.mockResolvedValue(action);
    mockPushProcessors.checkHiddenCommits.mockResolvedValue(action);

    mockPushProcessors.preReceive.mockResolvedValue({
      ...action,
      steps: [{ error: false, logs: ['Push automatically approved by pre-receive hook.'] }],
      allowPush: true,
      autoApproved: true,
    });

    mockPushProcessors.getDiff.mockResolvedValue(action);
    mockPushProcessors.gitleaks.mockResolvedValue(action);
    mockPushProcessors.clearBareClone.mockResolvedValue(action);
    mockPushProcessors.scanDiff.mockResolvedValue(action);
    mockPushProcessors.blockForAuth.mockResolvedValue(action);

    const error = new Error('Database error');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'authorise').mockRejectedValue(error);

    await chain.executeChain(req);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error during auto-approval:', error.message);
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
    mockPushProcessors.parsePush.mockResolvedValue(action);
    mockPushProcessors.checkEmptyBranch.mockResolvedValue(action);
    mockPushProcessors.checkRepoInAuthorisedList.mockResolvedValue(action);
    mockPushProcessors.checkCommitMessages.mockResolvedValue(action);
    mockPushProcessors.checkAuthorEmails.mockResolvedValue(action);
    mockPushProcessors.checkUserPushPermission.mockResolvedValue(action);
    mockPushProcessors.checkIfWaitingAuth.mockResolvedValue(action);
    mockPushProcessors.pullRemote.mockResolvedValue(action);
    mockPushProcessors.writePack.mockResolvedValue(action);
    mockPushProcessors.checkHiddenCommits.mockResolvedValue(action);

    mockPushProcessors.preReceive.mockResolvedValue({
      ...action,
      steps: [{ error: false, logs: ['Push automatically rejected by pre-receive hook.'] }],
      allowPush: false,
      autoRejected: true,
    });

    mockPushProcessors.getDiff.mockResolvedValue(action);
    mockPushProcessors.gitleaks.mockResolvedValue(action);
    mockPushProcessors.clearBareClone.mockResolvedValue(action);
    mockPushProcessors.scanDiff.mockResolvedValue(action);
    mockPushProcessors.blockForAuth.mockResolvedValue(action);

    const error = new Error('Database error');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db, 'reject').mockRejectedValue(error);

    await chain.executeChain(req);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error during auto-rejection:', error.message);
  });
});
