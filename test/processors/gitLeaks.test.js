const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { Action, Step } = require('../../src/proxy/actions');

chai.should();
const expect = chai.expect;

describe('gitleaks', () => {
  describe('exec', () => {
    let exec;
    let stubs;
    let action;
    let req;
    let stepSpy;
    let logStub;
    let errorStub;

    beforeEach(() => {
      stubs = {
        getAPIs: sinon.stub(),
        fs: {
          stat: sinon.stub(),
          access: sinon.stub(),
          constants: { R_OK: 0 }
        },
        spawn: sinon.stub()
      };

      logStub = sinon.stub(console, 'log');
      errorStub = sinon.stub(console, 'error');

      const gitleaksModule = proxyquire('../../src/proxy/processors/push-action/gitleaks', {
        '../../../config': { getAPIs: stubs.getAPIs },
        'node:fs/promises': stubs.fs,
        'node:child_process': { spawn: stubs.spawn }
      });

      exec = gitleaksModule.exec;

      req = {};
      action = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'test/repo'
      );
      action.proxyGitPath = '/tmp';
      action.repoName = 'test-repo';
      action.commitFrom = 'abc123';
      action.commitTo = 'def456';

      stepSpy = sinon.spy(Step.prototype, 'setError');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should handle config loading failure', async () => {
      stubs.getAPIs.throws(new Error('Config error'));

      const result = await exec(req, action);

      expect(result.error).to.be.true;
      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(stepSpy.calledWith('failed setup gitleaks, please contact an administrator\n')).to.be.true;
      expect(errorStub.calledWith('failed to get gitleaks config, please fix the error:')).to.be.true;
    });
  });
});
