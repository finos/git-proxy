const chai = require('chai');
const sinon = require('sinon');
const { PluginLoader } = require('../src/plugin');

chai.should();
const expect = chai.expect;

const mockLoader = {
  pushPlugins: [
    { exec: Object.assign(async () => console.log('foo'), { displayName: 'foo.exec' }) },
  ],
  pullPlugins: [
    { exec: Object.assign(async () => console.log('foo'), { displayName: 'bar.exec' }) },
  ],
};

const mockPushProcessors = {
  parsePush: sinon.stub(),
  audit: sinon.stub(),
  checkRepoInAuthorisedList: sinon.stub(),
  checkCommitMessages: sinon.stub(),
  checkAuthorEmails: sinon.stub(),
  checkUserPushPermission: sinon.stub(),
  checkIfWaitingAuth: sinon.stub(),
  pullRemote: sinon.stub(),
  writePack: sinon.stub(),
  getDiff: sinon.stub(),
  clearBareClone: sinon.stub(),
  scanDiff: sinon.stub(),
  blockForAuth: sinon.stub(),
};
mockPushProcessors.parsePush.displayName = 'parsePush';
mockPushProcessors.audit.displayName = 'audit';
mockPushProcessors.checkRepoInAuthorisedList.displayName = 'checkRepoInAuthorisedList';
mockPushProcessors.checkCommitMessages.displayName = 'checkCommitMessages';
mockPushProcessors.checkAuthorEmails.displayName = 'checkAuthorEmails';
mockPushProcessors.checkUserPushPermission.displayName = 'checkUserPushPermission';
mockPushProcessors.checkIfWaitingAuth.displayName = 'checkIfWaitingAuth';
mockPushProcessors.pullRemote.displayName = 'pullRemote';
mockPushProcessors.writePack.displayName = 'writePack';
mockPushProcessors.getDiff.displayName = 'getDiff';
mockPushProcessors.clearBareClone.displayName = 'clearBareClone';
mockPushProcessors.scanDiff.displayName = 'scanDiff';
mockPushProcessors.blockForAuth.displayName = 'blockForAuth';

const mockPreProcessors = {
  parseAction: sinon.stub(),
};

describe('proxy chain', function () {
  let processors;
  let chain;

  beforeEach(() => {
    // Re-require the processors module after clearing the cache
    processors = require('../src/proxy/processors');

    // Mock the processors module
    sinon.stub(processors, 'pre').value(mockPreProcessors);

    sinon.stub(processors, 'push').value(mockPushProcessors);

    // Re-require the chain module after stubbing processors
    chain = require('../src/proxy/chain');

    chain.chainPluginLoader = new PluginLoader([]);
  });

  afterEach(() => {
    // Clear the module from the cache after each test
    delete require.cache[require.resolve('../src/proxy/processors')];
    delete require.cache[require.resolve('../src/proxy/chain')];
    sinon.reset();
  });

  it('getChain should set pluginLoaded if loader is undefined', async function () {
    chain.chainPluginLoader = undefined;
    const actual = await chain.getChain({ type: 'push' });
    expect(actual).to.deep.equal(chain.pushActionChain);
    expect(chain.chainPluginLoader).to.be.undefined;
    expect(chain.pluginsInserted).to.be.true;
  });

  it('getChain should load plugins from an initialized PluginLoader', async function () {
    chain.chainPluginLoader = mockLoader;
    const initialChain = [...chain.pushActionChain];
    const actual = await chain.getChain({ type: 'push' });
    expect(actual.length).to.be.greaterThan(initialChain.length);
    expect(chain.pluginsInserted).to.be.true;
  });

  it('getChain should load pull plugins from an initialized PluginLoader', async function () {
    chain.chainPluginLoader = mockLoader;
    const initialChain = [...chain.pullActionChain];
    const actual = await chain.getChain({ type: 'pull' });
    expect(actual.length).to.be.greaterThan(initialChain.length);
    expect(chain.pluginsInserted).to.be.true;
  });

  it('executeChain should stop executing if action has continue returns false', async function () {
    const req = {};
    const continuingAction = { type: 'push', continue: () => true, allowPush: false };
    mockPreProcessors.parseAction.resolves({ type: 'push' });
    mockPushProcessors.parsePush.resolves(continuingAction);
    mockPushProcessors.checkRepoInAuthorisedList.resolves(continuingAction);
    mockPushProcessors.checkCommitMessages.resolves(continuingAction);
    mockPushProcessors.checkAuthorEmails.resolves(continuingAction);
    mockPushProcessors.checkUserPushPermission.resolves(continuingAction);

    // this stops the chain from further execution
    mockPushProcessors.checkIfWaitingAuth.resolves({
      type: 'push',
      continue: () => false,
      allowPush: false,
    });
    const result = await chain.executeChain(req);

    expect(mockPreProcessors.parseAction.called).to.be.true;
    expect(mockPushProcessors.parsePush.called).to.be.true;
    expect(mockPushProcessors.checkRepoInAuthorisedList.called).to.be.true;
    expect(mockPushProcessors.checkCommitMessages.called).to.be.true;
    expect(mockPushProcessors.checkAuthorEmails.called).to.be.true;
    expect(mockPushProcessors.checkUserPushPermission.called).to.be.true;
    expect(mockPushProcessors.checkIfWaitingAuth.called).to.be.true;
    expect(mockPushProcessors.pullRemote.called).to.be.false;
    expect(mockPushProcessors.audit.called).to.be.true;

    expect(result.type).to.equal('push');
    expect(result.allowPush).to.be.false;
    expect(result.continue).to.be.a('function');
  });

  it('executeChain should stop executing if action has allowPush is set to true', async function () {
    const req = {};
    const continuingAction = { type: 'push', continue: () => true, allowPush: false };
    mockPreProcessors.parseAction.resolves({ type: 'push' });
    mockPushProcessors.parsePush.resolves(continuingAction);
    mockPushProcessors.checkRepoInAuthorisedList.resolves(continuingAction);
    mockPushProcessors.checkCommitMessages.resolves(continuingAction);
    mockPushProcessors.checkAuthorEmails.resolves(continuingAction);
    mockPushProcessors.checkUserPushPermission.resolves(continuingAction);
    // this stops the chain from further execution
    mockPushProcessors.checkIfWaitingAuth.resolves({
      type: 'push',
      continue: () => true,
      allowPush: true,
    });
    const result = await chain.executeChain(req);

    expect(mockPreProcessors.parseAction.called).to.be.true;
    expect(mockPushProcessors.parsePush.called).to.be.true;
    expect(mockPushProcessors.checkRepoInAuthorisedList.called).to.be.true;
    expect(mockPushProcessors.checkCommitMessages.called).to.be.true;
    expect(mockPushProcessors.checkAuthorEmails.called).to.be.true;
    expect(mockPushProcessors.checkUserPushPermission.called).to.be.true;
    expect(mockPushProcessors.checkIfWaitingAuth.called).to.be.true;
    expect(mockPushProcessors.pullRemote.called).to.be.false;
    expect(mockPushProcessors.audit.called).to.be.true;

    expect(result.type).to.equal('push');
    expect(result.allowPush).to.be.true;
    expect(result.continue).to.be.a('function');
  });

  it('executeChain should execute all steps if all actions succeed', async function () {
    const req = {};
    const continuingAction = { type: 'push', continue: () => true, allowPush: false };
    mockPreProcessors.parseAction.resolves({ type: 'push' });
    mockPushProcessors.parsePush.resolves(continuingAction);
    mockPushProcessors.checkRepoInAuthorisedList.resolves(continuingAction);
    mockPushProcessors.checkCommitMessages.resolves(continuingAction);
    mockPushProcessors.checkAuthorEmails.resolves(continuingAction);
    mockPushProcessors.checkUserPushPermission.resolves(continuingAction);
    mockPushProcessors.checkIfWaitingAuth.resolves(continuingAction);
    mockPushProcessors.pullRemote.resolves(continuingAction);
    mockPushProcessors.writePack.resolves(continuingAction);
    mockPushProcessors.getDiff.resolves(continuingAction);
    mockPushProcessors.clearBareClone.resolves(continuingAction);
    mockPushProcessors.scanDiff.resolves(continuingAction);
    mockPushProcessors.blockForAuth.resolves(continuingAction);

    const result = await chain.executeChain(req);

    expect(mockPreProcessors.parseAction.called).to.be.true;
    expect(mockPushProcessors.parsePush.called).to.be.true;
    expect(mockPushProcessors.checkRepoInAuthorisedList.called).to.be.true;
    expect(mockPushProcessors.checkCommitMessages.called).to.be.true;
    expect(mockPushProcessors.checkAuthorEmails.called).to.be.true;
    expect(mockPushProcessors.checkUserPushPermission.called).to.be.true;
    expect(mockPushProcessors.checkIfWaitingAuth.called).to.be.true;
    expect(mockPushProcessors.pullRemote.called).to.be.true;
    expect(mockPushProcessors.writePack.called).to.be.true;
    expect(mockPushProcessors.getDiff.called).to.be.true;
    expect(mockPushProcessors.clearBareClone.called).to.be.true;
    expect(mockPushProcessors.scanDiff.called).to.be.true;
    expect(mockPushProcessors.blockForAuth.called).to.be.true;
    expect(mockPushProcessors.audit.called).to.be.true;

    expect(result.type).to.equal('push');
    expect(result.allowPush).to.be.false;
    expect(result.continue).to.be.a('function');
  });

  it('executeChain should run the expected steps for pulls', async function () {
    const req = {};
    const continuingAction = { type: 'pull', continue: () => true, allowPush: false };
    mockPreProcessors.parseAction.resolves({ type: 'pull' });
    mockPushProcessors.checkRepoInAuthorisedList.resolves(continuingAction);
    const result = await chain.executeChain(req);

    expect(mockPushProcessors.checkRepoInAuthorisedList.called).to.be.true;
    expect(mockPushProcessors.parsePush.called).to.be.false;
    expect(result.type).to.equal('pull');
  });

  it('executeChain should handle errors and still call audit', async function () {
    const req = {};
    const action = { type: 'push', continue: () => true, allowPush: true };

    processors.pre.parseAction.resolves(action);
    mockPushProcessors.parsePush.rejects(new Error('Audit error'));

    try {
      await chain.executeChain(req);
    } catch (e) {
      // Ignore the error
    }

    expect(mockPushProcessors.audit.called).to.be.true;
  });

  it('executeChain should run no actions if not a push or pull', async function () {
    const req = {};
    const action = { type: 'foo', continue: () => true, allowPush: true };

    processors.pre.parseAction.resolves(action);

    const result = await chain.executeChain(req);

    expect(mockPushProcessors.checkRepoInAuthorisedList.called).to.be.false;
    expect(mockPushProcessors.parsePush.called).to.be.false;
    expect(result).to.deep.equal(action);
  });
});
