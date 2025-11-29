const { expect } = require('chai');
const sinon = require('sinon');
const axios = require('axios');

describe('git-push service', () => {
  let axiosPostStub;
  let gitPushService;

  before(() => {
    global.location = { origin: 'http://localhost:8080' };

    global.localStorage = {
      getItem: sinon.stub().returns(null),
    };

    global.document = {
      cookie: '',
    };
  });

  after(() => {
    delete global.location;
    delete global.localStorage;
    delete global.document;
  });

  beforeEach(() => {
    axiosPostStub = sinon.stub(axios, 'post');
    gitPushService = require('../../../src/ui/services/git-push');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('rejectPush', () => {
    it('should return true when successfully rejected a push', async () => {
      const setMessageSpy = sinon.spy();
      axiosPostStub.resolves({ status: 200 });

      const result = await gitPushService.rejectPush('test-push-id-123', setMessageSpy);

      expect(result).to.be.true;
      expect(setMessageSpy.calledWith('')).to.be.true;
      expect(axiosPostStub.firstCall.args[0]).to.equal(
        'http://localhost:8080/api/v1/push/test-push-id-123/reject',
      );
    });

    it('should return false when returns 401', async () => {
      const pushId = 'test-push-id-456';
      const setMessageSpy = sinon.spy();

      const error = new Error('Unauthorized');
      error.response = {
        status: 401,
      };
      axiosPostStub.rejects(error);

      const result = await gitPushService.rejectPush(pushId, setMessageSpy);

      expect(result).to.be.false;
      expect(setMessageSpy.calledOnce).to.be.true;
      expect(setMessageSpy.calledWith('You are not authorised to reject...')).to.be.true;
      expect(axiosPostStub.calledOnce).to.be.true;
    });
  });

  describe('authorisePush', () => {
    it('should return true when authorised a push', async () => {
      const setMessageStub = sinon.stub();
      const attestation = [
        { label: 'Reviewed code', checked: true },
        { label: 'Verified tests', checked: true },
      ];

      axiosPostStub.resolves({ status: 200 });

      const result = await gitPushService.authorisePush(
        'test-push-id-789',
        setMessageStub,
        attestation,
      );

      expect(result).to.be.true;
      expect(setMessageStub.calledOnceWith('')).to.be.true;
      expect(axiosPostStub.firstCall.args[0]).to.equal(
        'http://localhost:8080/api/v1/push/test-push-id-789/authorise',
      );
      expect(axiosPostStub.firstCall.args[1]).to.deep.equal({
        params: {
          attestation,
        },
      });
    });

    it('should return false when returned 401', async () => {
      const setMessageStub = sinon.stub();
      const attestation = [{ label: 'Reviewed code', checked: true }];

      const error = new Error('Unauthorized');
      error.response = {
        status: 401,
      };
      axiosPostStub.rejects(error);

      const result = await gitPushService.authorisePush(
        'test-push-id-101',
        setMessageStub,
        attestation,
      );

      expect(result).to.be.false;
      expect(setMessageStub.calledOnceWith('You are not authorised to approve...')).to.be.true;
      expect(axiosPostStub.calledOnce).to.be.true;
    });
  });
});
