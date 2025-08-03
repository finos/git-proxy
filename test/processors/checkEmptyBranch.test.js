const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { Action } = require('../../src/proxy/actions');

chai.should();
const expect = chai.expect;

describe.only('checkEmptyBranch', () => {
  let exec;
  let simpleGitStub;
  let gitRawStub;

  beforeEach(() => {
    gitRawStub = sinon.stub();
    simpleGitStub = sinon.stub().callsFake((workingDir) => {
      return { 
        raw: gitRawStub,
        cwd: workingDir
      };
    });

    const checkEmptyBranch = proxyquire('../../src/proxy/processors/push-action/checkEmptyBranch', {
      'simple-git': {
        default: simpleGitStub,
        __esModule: true,
        '@global': true,
        '@noCallThru': true
      },
      // deeply mocking fs to prevent simple-git from validating directories (which fails)
      'fs': {
        existsSync: sinon.stub().returns(true),
        lstatSync: sinon.stub().returns({
          isDirectory: () => true,
          isFile: () => false
        }),
        '@global': true
      }
    });

    exec = checkEmptyBranch.exec;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('exec', () => {
    let action;
    let req;

    beforeEach(() => {
      req = {};
      action = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'test/repo'
      );
      action.proxyGitPath = '/tmp/gitproxy';
      action.repoName = 'test-repo';
      action.commitFrom = '0000000000000000000000000000000000000000';
      action.commitTo = 'abcdef1234567890abcdef1234567890abcdef12';
      action.commitData = [];
    });

    it('should pass through if commitData is already populated', async () => {
      action.commitData = [{ message: 'Existing commit' }];

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(0);
      expect(simpleGitStub.called).to.be.false;
    });

    it('should block empty branch pushes with a commit that exists', async () => {
      gitRawStub.resolves('commit\n');

      const result = await exec(req, action);

      expect(simpleGitStub.calledWith('/tmp/gitproxy/test-repo')).to.be.true;
      expect(gitRawStub.calledWith(['cat-file', '-t', action.commitTo])).to.be.true;

      const step = result.steps.find(s => s.stepName === 'checkEmptyBranch');
      expect(step).to.exist;
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('Push blocked: Empty branch');
    });

    it('should block pushes if commitTo does not resolve', async () => {
      gitRawStub.rejects(new Error('fatal: Not a valid object name'));

      const result = await exec(req, action);

      expect(gitRawStub.calledWith(['cat-file', '-t', action.commitTo])).to.be.true;

      const step = result.steps.find(s => s.stepName === 'checkEmptyBranch');
      expect(step).to.exist;
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('Push blocked: Commit data not found');
    });

    it('should block non-empty branch pushes with empty commitData', async () => {
      action.commitFrom = 'abcdef1234567890abcdef1234567890abcdef12';

      const result = await exec(req, action);

      expect(simpleGitStub.called).to.be.true;

      const step = result.steps.find(s => s.stepName === 'checkEmptyBranch');
      expect(step).to.exist;
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('Push blocked: Commit data not found');
    });
  });
});
