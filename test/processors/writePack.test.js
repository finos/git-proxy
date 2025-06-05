const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { Action, Step } = require('../../src/proxy/actions');

chai.should();
const expect = chai.expect;

describe('writePack', () => {
  let exec;
  let spawnSyncStub;
  let stepLogSpy;
  let stepSetContentSpy;
  let stepSetErrorSpy;

  beforeEach(() => {
    spawnSyncStub = sinon.stub().returns({
      stdout: 'git receive-pack output',
      stderr: '',
      status: 0
    });

    stepLogSpy = sinon.spy(Step.prototype, 'log');
    stepSetContentSpy = sinon.spy(Step.prototype, 'setContent');
    stepSetErrorSpy = sinon.spy(Step.prototype, 'setError');

    const writePack = proxyquire('../../src/proxy/processors/push-action/writePack', {
      'child_process': { spawnSync: spawnSyncStub }
    });

    exec = writePack.exec;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('exec', () => {
    let action;
    let req;

    beforeEach(() => {
      req = {
        body: 'pack data'
      };
      action = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'test/repo'
      );
      action.proxyGitPath = '/path/to/repo';
    });

    it('should execute git receive-pack with correct parameters', async () => {
      const result = await exec(req, action);

      expect(spawnSyncStub.calledOnce).to.be.true;
      expect(spawnSyncStub.firstCall.args[0]).to.equal('git');
      expect(spawnSyncStub.firstCall.args[1]).to.deep.equal(['receive-pack', 'repo']);
      expect(spawnSyncStub.firstCall.args[2]).to.deep.equal({
        cwd: '/path/to/repo',
        input: 'pack data',
        encoding: 'utf-8'
      });

      expect(stepLogSpy.calledWith('executing git receive-pack repo')).to.be.true;
      expect(stepLogSpy.calledWith('git receive-pack output')).to.be.true;

      expect(stepSetContentSpy.calledWith('git receive-pack output')).to.be.true;

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.false;
    });

    it('should handle errors from git receive-pack', async () => {
      const error = new Error('git error');
      spawnSyncStub.throws(error);

      try {
        await exec(req, action);
        throw new Error('Expected error to be thrown');
      } catch (e) {
        expect(stepSetErrorSpy.calledOnce).to.be.true;
        expect(stepSetErrorSpy.firstCall.args[0]).to.include('git error');

        expect(action.steps).to.have.lengthOf(1);
        expect(action.steps[0].error).to.be.true;
      }
    });

    it('should always add the step to the action even if error occurs', async () => {
      spawnSyncStub.throws(new Error('git error'));

      try {
        await exec(req, action);
      } catch (e) {
        expect(action.steps).to.have.lengthOf(1);
      }
    });

    it('should have the correct displayName', () => {
      expect(exec.displayName).to.equal('writePack.exec');
    });
  });
});
