const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

const mockConfig = {
  getCommitConfig: () => ({
    diff: {
      block: {
        literals: ['blocked literal'],
        patterns: ['blocked pattern'],
        providers: { provider: 'blocked provider' }
      }
    }
  }),
  getPrivateOrganizations: () => ['privateOrg']
};
const { exec } = proxyquire('../src/proxy/processors/push-action/scanDiff', {
  '../../../config': mockConfig
});

describe('exec', () => {
  let req;
  let action;

  beforeEach(() => {
    req = {}
    action = {
      steps: [],
      commitFrom: 'commitFromHash',
      commitTo: 'commitToHash',
      project: 'testproject',
      addStep: function (step) {
        this.steps.push(step);
      }
    };
  });

  it('should block the push if diff is empty', async () => {
    action.steps.push({ stepName: 'diff', content: '' });
    const result = await exec(req, action);
    expect(result.steps[1].error).to.be.true;
  });

  it('should block the push if diff is not a string', async () => {
    action.steps.push({ stepName: 'diff', content: null });
    const result = await exec(req, action);
    expect(result.steps[1].error).to.be.true;
  });

  it('should block the push if diff is undefined', async () => {
    action.steps.push({ stepName: 'diff', content: undefined });
    const result = await exec(req, action);
    expect(result.steps[1].error).to.be.true;
  });

  it('should block the push if diff contains blocked literals', async () => {
    action.steps.push({ stepName: 'diff', content: 'blocked literal' });
    const result = await exec(req, action);
    expect(result.steps[1].error).to.be.true;
  });

  it('should block the push if diff contains blocked patterns', async () => {
    action.steps.push({ stepName: 'diff', content: 'blocked pattern' });
    const result = await exec(req, action);
    expect(result.steps[1].error).to.be.true;
  });

  it('should block the push if diff contains blocked providers and organization is not private', async () => {
    action.steps.push({ stepName: 'diff', content: 'blocked provider' });
    action.project = 'nonPrivateOrganization';
    const result = await exec(req, action);
    expect(result.steps[1].error).to.be.true;
  });

  it('should block the push if diff contains blocked providers and organization is private', async () => {
    action.steps.push({ stepName: 'diff', content: 'This contains a blocked provider' });
    action.project = 'privateOrg';
    const result = await exec(req, action);
    expect(result.steps[1].error).to.be.false;
  });

  it('should allow the push if diff does not contain blocked literals, patterns, or providers', async () => {
    action.steps.push({ stepName: 'diff', content: 'This is a safe diff' });
    const result = await exec(req, action);
    expect(result.steps[1].error).to.be.false;
  });

  it('should return the action object if the diff is legal', async () => {
    action.steps.push({ stepName: 'diff', content: 'This is a safe diff' });
    const result = await exec(req, action);
    expect(result).to.equal(action);
  });
});
