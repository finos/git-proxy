const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { Action } = require('../../src/proxy/actions');

chai.should();
const expect = chai.expect;

describe('checkIfWaitingAuth', () => {
  let exec;
  let getPushStub;

  beforeEach(() => {
    getPushStub = sinon.stub();

    const checkIfWaitingAuth = proxyquire(
      '../../src/proxy/processors/push-action/checkIfWaitingAuth',
      {
        '../../../db': { getPush: getPushStub },
      },
    );

    exec = checkIfWaitingAuth.exec;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('exec', () => {
    let action;
    let req;

    beforeEach(() => {
      req = {};
      action = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo');
    });

    it('should set allowPush when action exists and is authorized', async () => {
      const authorizedAction = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo');
      authorizedAction.authorised = true;
      getPushStub.resolves(authorizedAction);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.false;
      expect(result.allowPush).to.be.true;
      expect(result).to.deep.equal(authorizedAction);
    });

    it('should not set allowPush when action exists but not authorized', async () => {
      const unauthorizedAction = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo');
      unauthorizedAction.authorised = false;
      getPushStub.resolves(unauthorizedAction);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.false;
      expect(result.allowPush).to.be.false;
    });

    it('should not set allowPush when action does not exist', async () => {
      getPushStub.resolves(null);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.false;
      expect(result.allowPush).to.be.false;
    });

    it('should not modify action when it has an error', async () => {
      action.error = true;
      const authorizedAction = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo');
      authorizedAction.authorised = true;
      getPushStub.resolves(authorizedAction);

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.false;
      expect(result.allowPush).to.be.false;
      expect(result.error).to.be.true;
    });

    it('should add step with error when getPush throws', async () => {
      const error = new Error('DB error');
      getPushStub.rejects(error);

      try {
        await exec(req, action);
        throw new Error('Should have thrown');
      } catch (e) {
        expect(e).to.equal(error);
        expect(action.steps).to.have.lengthOf(1);
        expect(action.steps[0].error).to.be.true;
        expect(action.steps[0].errorMessage).to.contain('DB error');
      }
    });
  });
});
