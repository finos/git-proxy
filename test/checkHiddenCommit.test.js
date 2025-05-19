// test/checkHiddenCommits.test.js
const fs = require('fs');
const childProcess = require('child_process');
import * as sinon from 'sinon';
const { expect } = require('chai');

const { exec: checkHidden } = require('../src/proxy/processors/push-action/checkHiddenCommits');
const { Action } = require('../src/proxy/actions');

describe('checkHiddenCommits.exec', () => {
  let action;
  let sandbox;
  let spawnSyncStub;
  let readdirSyncStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // stub spawnSync and fs.readdirSync
    spawnSyncStub = sandbox.stub(childProcess, 'spawnSync');
    readdirSyncStub = sandbox.stub(fs, 'readdirSync');

    // prepare a fresh Action
    action = new Action('some-id', 'push', 'POST', Date.now(), 'repo.git');
    action.proxyGitPath = '/fake';
    action.commitFrom = '0000000000000000000000000000000000000000';
    action.commitTo = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    action.newIdxFiles = ['pack-test.idx'];
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('reports all commits unreferenced and sets error=true', async () => {
    // 1) rev-list → no introduced commits
    // 2) verify-pack → two commits in pack
    spawnSyncStub.onFirstCall().returns({ stdout: '' }).onSecondCall().returns({
      stdout: 'deadbeef commit 100 1\ncafebabe commit 100 2\n',
    });

    readdirSyncStub.returns(['pack-test.idx']);

    await checkHidden({ body: '' }, action);

    const step = action.steps.find((s) => s.stepName === 'checkHiddenCommits');
    expect(step.logs).to.include('checkHiddenCommits - ❌ Unreferenced commits: 2');
    expect(action.error).to.be.true;
  });

  it('mixes referenced & unreferenced correctly', async () => {
    // 1) git rev-list → introduces one commit “deadbeef”
    // 2) git verify-pack → the pack contains two commits
    spawnSyncStub.onFirstCall().returns({ stdout: 'deadbeef\n' }).onSecondCall().returns({
      stdout: 'deadbeef commit 100 1\ncafebabe commit 100 2\n',
    });

    readdirSyncStub.returns(['pack-test.idx']);

    await checkHidden({ body: '' }, action);

    const step = action.steps.find((s) => s.stepName === 'checkHiddenCommits');
    expect(step.logs).to.include('checkHiddenCommits - ✅ Referenced commits: 1');
    expect(step.logs).to.include('checkHiddenCommits - ❌ Unreferenced commits: 1');
    expect(action.error).to.be.true;
  });

  it.only('reports all commits referenced and sets error=false', async () => {
    // 1) rev-list → introduces both commits
    // 2) verify-pack → the pack contains the same two commits
    spawnSyncStub.onFirstCall().returns({ stdout: 'deadbeef\ncafebabe\n' }).onSecondCall().returns({
      stdout: 'deadbeef commit 100 1\ncafebabe commit 100 2\n',
    });

    readdirSyncStub.returns(['pack-test.idx']);

    await checkHidden({ body: '' }, action);

    const step = action.steps.find((s) => s.stepName === 'checkHiddenCommits');
    expect(step.logs).to.include('checkHiddenCommits - ✅ Referenced commits: 2');
    expect(step.logs).to.include('checkHiddenCommits - ❌ Unreferenced commits: 0');
    expect(action.error).to.be.false;
  });

  it('throws if commitFrom or commitTo is missing', async () => {
    delete action.commitFrom;

    try {
      await checkHidden({ body: '' }, action);
      throw new Error('Expected checkHidden to throw');
    } catch (err) {
      expect(err.message).to.match(/Both action.commitFrom and action.commitTo must be defined/);
    }
  });
});
