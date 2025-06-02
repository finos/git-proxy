const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const { expect } = require('chai');

describe('checkAuthorEmails', () => {
  let exec;
  let Step;
  let getCommitConfig;
  let stepSpy;
  let action;
  let config;

  beforeEach(() => {
    Step = class {
      constructor() {
        this.error = undefined;
      }
      log() {}
      setError() {}
    };
    stepSpy = sinon.spy(Step.prototype, 'log');
    sinon.spy(Step.prototype, 'setError');

    config = {
      author: {
        email: {
          domain: { allow: null },
          local: { block: null }
        }
      }
    };
    getCommitConfig = sinon.stub().returns(config);

    action = {
      commitData: [],
      addStep: sinon.stub().callsFake(function(step) {
        this.step = new Step();
        Object.assign(this.step, step);
        return this.step;
      })
    };

    exec = proxyquire('../../src/proxy/processors/push-action/checkAuthorEmails', {
      '../../../config': { getCommitConfig },
      '../../actions': { Step }
    }).exec;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should allow valid emails when no restrictions', async () => {
    action.commitData = [
      { authorEmail: 'valid@example.com' },
      { authorEmail: 'another.valid@test.org' }
    ];

    await exec({}, action);

    expect(action.step.error).to.be.undefined;
  });

  it('should block emails from forbidden domains', async () => {
    config.author.email.domain.allow = 'example\\.com$';
    action.commitData = [
      { authorEmail: 'valid@example.com' },
      { authorEmail: 'invalid@forbidden.org' }
    ];

    await exec({}, action);

    expect(action.step.error).to.be.true;
    expect(stepSpy.calledWith(
      'The following commit author e-mails are illegal: invalid@forbidden.org'
    )).to.be.true;
    expect(Step.prototype.setError.calledWith(
      'Your push has been blocked. Please verify your Git configured e-mail address is valid (e.g. john.smith@example.com)'
    )).to.be.true;
  });

  it('should block emails with forbidden usernames', async () => {
    config.author.email.local.block = 'blocked';
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
    config.author.email.domain.allow = 'example\\.com$';
    config.author.email.local.block = 'forbidden';
    action.commitData = [
      { authorEmail: 'allowed@example.com' },
      { authorEmail: 'also.allowed@example.com' }
    ];

    await exec({}, action);

    expect(action.step.error).to.be.undefined;
  });

  it('should block emails that fail both checks', async () => {
    config.author.email.domain.allow = 'example\\.com$';
    config.author.email.local.block = 'forbidden';
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
    config.author.email.domain.allow = 'example\\.com$';
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
