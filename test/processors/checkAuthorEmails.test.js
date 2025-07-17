const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const { expect } = require('chai');

describe('checkAuthorEmails', () => {
  let action;
  let commitConfig
  let exec;
  let getCommitConfigStub;
  let stepSpy;
  let StepStub;

  beforeEach(() => {
    StepStub = class {
      constructor() {
        this.error = undefined;
      }
      log() {}
      setError() {}
    };
    stepSpy = sinon.spy(StepStub.prototype, 'log');
    sinon.spy(StepStub.prototype, 'setError');

    commitConfig = {
      author: {
        email: {
          domain: { allow: null },
          local: { block: null }
        }
      }
    };
    getCommitConfigStub = sinon.stub().returns(commitConfig);

    action = {
      commitData: [],
      addStep: sinon.stub().callsFake((step) => {
        action.step = new StepStub();
        Object.assign(action.step, step);
        return action.step;
      })
    };

    const checkAuthorEmails = proxyquire('../../src/proxy/processors/push-action/checkAuthorEmails', {
      '../../../config': { getCommitConfig: getCommitConfigStub },
      '../../actions': { Step: StepStub }
    });

    exec = checkAuthorEmails.exec;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('exec', () => {
    it('should allow valid emails when no restrictions', async () => {
      action.commitData = [
        { authorEmail: 'valid@example.com' },
        { authorEmail: 'another.valid@test.org' }
      ];

      await exec({}, action);

      expect(action.step.error).to.be.undefined;
    });

    it('should block emails from forbidden domains', async () => {
      commitConfig.author.email.domain.allow = 'example\\.com$';
      action.commitData = [
        { authorEmail: 'valid@example.com' },
        { authorEmail: 'invalid@forbidden.org' }
      ];

      await exec({}, action);

      expect(action.step.error).to.be.true;
      expect(stepSpy.calledWith(
        'The following commit author e-mails are illegal: invalid@forbidden.org'
      )).to.be.true;
      expect(StepStub.prototype.setError.calledWith(
        'Your push has been blocked. Please verify your Git configured e-mail address is valid (e.g. john.smith@example.com)'
      )).to.be.true;
    });

    it('should block emails with forbidden usernames', async () => {
      commitConfig.author.email.local.block = 'blocked';
      action.commitData = [
        { authorEmail: 'allowed@example.com' },
        { authorEmail: 'blocked.user@test.org' }
      ];

      await exec({}, action);

      expect(action.step.error).to.be.true;
      expect(stepSpy.calledWith(
        'The following commit author e-mails are illegal: blocked.user@test.org'
      )).to.be.true;
    });

    it('should handle empty email strings', async () => {
      action.commitData = [
        { authorEmail: '' },
        { authorEmail: 'valid@example.com' }
      ];

      await exec({}, action);

      expect(action.step.error).to.be.true;
      expect(stepSpy.calledWith(
        'The following commit author e-mails are illegal: '
      )).to.be.true;
    });

    it('should allow emails when both checks pass', async () => {
      commitConfig.author.email.domain.allow = 'example\\.com$';
      commitConfig.author.email.local.block = 'forbidden';
      action.commitData = [
        { authorEmail: 'allowed@example.com' },
        { authorEmail: 'also.allowed@example.com' }
      ];

      await exec({}, action);

      expect(action.step.error).to.be.undefined;
    });

    it('should block emails that fail both checks', async () => {
      commitConfig.author.email.domain.allow = 'example\\.com$';
      commitConfig.author.email.local.block = 'forbidden';
      action.commitData = [
        { authorEmail: 'forbidden@wrong.org' }
      ];

      await exec({}, action);

      expect(action.step.error).to.be.true;
      expect(stepSpy.calledWith(
        'The following commit author e-mails are illegal: forbidden@wrong.org'
      )).to.be.true;
    });

    it('should handle emails without domain', async () => {
      action.commitData = [
        { authorEmail: 'nodomain@' }
      ];

      await exec({}, action);

      expect(action.step.error).to.be.true;
      expect(stepSpy.calledWith(
        'The following commit author e-mails are illegal: nodomain@'
      )).to.be.true;
    });

    it('should handle multiple illegal emails', async () => {
      commitConfig.author.email.domain.allow = 'example\\.com$';
      action.commitData = [
        { authorEmail: 'invalid1@bad.org' },
        { authorEmail: 'invalid2@wrong.net' },
        { authorEmail: 'valid@example.com' }
      ];

      await exec({}, action);

      expect(action.step.error).to.be.true;
      expect(stepSpy.calledWith(
        'The following commit author e-mails are illegal: invalid1@bad.org,invalid2@wrong.net'
      )).to.be.true;
    });
  });
});
