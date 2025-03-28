const { expect } = require('chai');
const sinon = require('sinon');
const child = require('child_process');
const { exec } = require('../src/proxy/processors/push-action/getDiff');
const { Step } = require('../src/proxy/actions');

describe('getDiff.exec', () => {
  let req;
  let action;
  let spawnSyncStub;

  beforeEach(() => {
    req = {}
    action = {
      proxyGitPath: '/path/to/git',
      repoName: 'my-repo',
      commitFrom: 'commit-from',
      commitTo: 'commit-to',
      commitData: [{ parent: 'parent-commit' }],
      addStep: sinon.stub(),
    };
    spawnSyncStub = sinon.stub(child, 'spawnSync').returns({ stdout: 'diff content' });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should execute git diff command and set the content', async () => {
    const expectedContent = 'diff content';

    await exec(req, action);

    expect(
      spawnSyncStub.calledOnceWithExactly(
        'git',
        ['diff', 'commit-from', 'commit-to'],
        {
          cwd: '/path/to/git/my-repo',
          encoding: 'utf-8',
          maxBuffer: 50 * 1024 * 1024,
        }
      )
    ).to.be.true;

    expect(action.addStep.calledOnce).to.be.true;
    const step = action.addStep.getCall(0).args[0];
    expect(step).to.be.instanceOf(Step);
    expect(step.content).to.equal(expectedContent);
  });

  it('should handle error and set the error message', async () => {
    const errorMessage = 'some error';
    spawnSyncStub.throws(new Error(errorMessage));

    await exec(req, action);

    expect(action.addStep.calledOnce).to.be.true;
    const step = action.addStep.getCall(0).args[0];
    expect(step).to.be.instanceOf(Step);
  });

  it('should handle commitFrom as all zeros and set the correct commitFrom', async () => {
    action.commitFrom = '0000000000000000000000000000000000000000';
    action.commitData = [{ parent: 'parent-commit' }];

    await exec(req, action);

    expect(
      spawnSyncStub.calledOnceWithExactly(
        'git',
        ['diff', 'parent-commit', 'commit-to'],
        {
          cwd: '/path/to/git/my-repo',
          encoding: 'utf-8',
          maxBuffer: 50 * 1024 * 1024,
        }
      )
    ).to.be.true;
  });

  it('should handle commitFrom as all zeros and no parent commit', async () => {
    action.commitFrom = '0000000000000000000000000000000000000000';
    action.commitData = [{ parent: '0000000000000000000000000000000000000000' }];

    await exec(req, action);

    expect(
      spawnSyncStub.calledOnceWithExactly(
        'git',
        ['diff', '4b825dc642cb6eb9a060e54bf8d69288fbee4904', 'commit-to'],
        {
          cwd: '/path/to/git/my-repo',
          encoding: 'utf-8',
          maxBuffer: 50 * 1024 * 1024,
        }
      )
    ).to.be.true;
  });
});
