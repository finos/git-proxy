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
      setItem: sinon.stub(),
      removeItem: sinon.stub(),
      clear: sinon.stub(),
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

    delete require.cache[require.resolve('../../../src/ui/services/git-push')];
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
});
