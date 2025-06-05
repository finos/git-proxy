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

    it('should skip scanning when plugin is disabled', async () => {
      stubs.getAPIs.returns({ gitleaks: { enabled: false } });

      const result = await exec(req, action);

      expect(result.error).to.be.false;
      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.false;
      expect(logStub.calledWith('gitleaks is disabled, skipping')).to.be.true;
    });

    it('should handle successful scan with no findings', async () => {
      stubs.getAPIs.returns({ gitleaks: { enabled: true } });

      const gitRootCommitMock = {
        exitCode: 0,
        stdout: 'rootcommit123\n',
        stderr: ''
      };

      const gitleaksMock = {
        exitCode: 0,
        stdout: '',
        stderr: 'No leaks found'
      };

      stubs.spawn
        .onFirstCall().returns({
          on: (event, cb) => {
            if (event === 'close') cb(gitRootCommitMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_, cb) => cb(gitRootCommitMock.stdout) },
          stderr: { on: (_, cb) => cb(gitRootCommitMock.stderr) }
        })
        .onSecondCall().returns({
          on: (event, cb) => {
            if (event === 'close') cb(gitleaksMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_, cb) => cb(gitleaksMock.stdout) },
          stderr: { on: (_, cb) => cb(gitleaksMock.stderr) }
        });

      const result = await exec(req, action);

      expect(result.error).to.be.false;
      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.false;
      expect(logStub.calledWith('succeded')).to.be.true;
      expect(logStub.calledWith('No leaks found')).to.be.true;
    });

    it('should handle scan with findings', async () => {
      stubs.getAPIs.returns({ gitleaks: { enabled: true } });

      const gitRootCommitMock = {
        exitCode: 0,
        stdout: 'rootcommit123\n',
        stderr: ''
      };

      const gitleaksMock = {
        exitCode: 99,
        stdout: 'Found secret in file.txt\n',
        stderr: 'Warning: potential leak'
      };

      stubs.spawn
        .onFirstCall().returns({
          on: (event, cb) => {
            if (event === 'close') cb(gitRootCommitMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_, cb) => cb(gitRootCommitMock.stdout) },
          stderr: { on: (_, cb) => cb(gitRootCommitMock.stderr) }
        })
        .onSecondCall().returns({
          on: (event, cb) => {
            if (event === 'close') cb(gitleaksMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_, cb) => cb(gitleaksMock.stdout) },
          stderr: { on: (_, cb) => cb(gitleaksMock.stderr) }
        });

      const result = await exec(req, action);

      expect(result.error).to.be.true;
      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(stepSpy.calledWith('\nFound secret in file.txt\nWarning: potential leak')).to.be.true;
    });

    it('should handle gitleaks execution failure', async () => {
      stubs.getAPIs.returns({ gitleaks: { enabled: true } });

      const gitRootCommitMock = {
        exitCode: 0,
        stdout: 'rootcommit123\n',
        stderr: ''
      };

      const gitleaksMock = {
        exitCode: 1,
        stdout: '',
        stderr: 'Command failed'
      };

      stubs.spawn
        .onFirstCall().returns({
          on: (event, cb) => {
            if (event === 'close') cb(gitRootCommitMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_, cb) => cb(gitRootCommitMock.stdout) },
          stderr: { on: (_, cb) => cb(gitRootCommitMock.stderr) }
        })
        .onSecondCall().returns({
          on: (event, cb) => {
            if (event === 'close') cb(gitleaksMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_, cb) => cb(gitleaksMock.stdout) },
          stderr: { on: (_, cb) => cb(gitleaksMock.stderr) }
        });

      const result = await exec(req, action);

      expect(result.error).to.be.true;
      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(stepSpy.calledWith('failed to run gitleaks, please contact an administrator\n')).to.be.true;
    });

    it('should handle custom config path', async () => {
      stubs.getAPIs.returns({ 
        gitleaks: { 
          enabled: true,
          configPath: `../fixtures/gitleaks-config.toml`
        } 
      });

      stubs.fs.stat.resolves({ isFile: () => true });
      stubs.fs.access.resolves();

      const gitRootCommitMock = {
        exitCode: 0,
        stdout: 'rootcommit123\n',
        stderr: ''
      };

      const gitleaksMock = {
        exitCode: 0,
        stdout: '',
        stderr: 'No leaks found'
      };

      stubs.spawn
        .onFirstCall().returns({
          on: (event, cb) => {
            if (event === 'close') cb(gitRootCommitMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_, cb) => cb(gitRootCommitMock.stdout) },
          stderr: { on: (_, cb) => cb(gitRootCommitMock.stderr) }
        })
        .onSecondCall().returns({
          on: (event, cb) => {
            if (event === 'close') cb(gitleaksMock.exitCode);
            return { stdout: { on: () => {} }, stderr: { on: () => {} } };
          },
          stdout: { on: (_, cb) => cb(gitleaksMock.stdout) },
          stderr: { on: (_, cb) => cb(gitleaksMock.stderr) }
        });

      const result = await exec(req, action);

      expect(result.error).to.be.false;
      expect(result.steps[0].error).to.be.false;
      expect(stubs.spawn.secondCall.args[1]).to.include('--config=../fixtures/gitleaks-config.toml');
    });
  });
});
