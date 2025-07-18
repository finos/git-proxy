const fc = require('fast-check');
const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const { Step } = require('../../src/proxy/actions');

chai.should();
const expect = chai.expect;

describe('blockForAuth', () => {
  let action;
  let exec;
  let getServiceUIURLStub;
  let req;
  let stepInstance;
  let StepSpy;

  beforeEach(() => {
    req = {
      protocol: 'https',
      headers: { host: 'example.com' }
    };

    action = {
      id: 'push_123',
      addStep: sinon.stub()
    };

    stepInstance = new Step('temp');
    sinon.stub(stepInstance, 'setAsyncBlock');

    StepSpy = sinon.stub().returns(stepInstance);

    getServiceUIURLStub = sinon.stub().returns('http://localhost:8080');

    const blockForAuth = proxyquire('../../src/proxy/processors/push-action/blockForAuth', {
      '../../../service/urls': { getServiceUIURL: getServiceUIURLStub },
      '../../actions': { Step: StepSpy }
    });

    exec = blockForAuth.exec;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('exec', () => {

    it('should generate a correct shareable URL', async () => {
      await exec(req, action);
      expect(getServiceUIURLStub.calledOnce).to.be.true;
      expect(getServiceUIURLStub.calledWithExactly(req)).to.be.true;
    });

    it('should create step with correct parameters', async () => {
      await exec(req, action);

      expect(StepSpy.calledOnce).to.be.true;
      expect(StepSpy.calledWithExactly('authBlock')).to.be.true;
      expect(stepInstance.setAsyncBlock.calledOnce).to.be.true;

      const message = stepInstance.setAsyncBlock.firstCall.args[0];
      expect(message).to.include('http://localhost:8080/dashboard/push/push_123');
      expect(message).to.include('\x1B[32mGitProxy has received your push ✅\x1B[0m');
      expect(message).to.include('\x1B[34mhttp://localhost:8080/dashboard/push/push_123\x1B[0m');
      expect(message).to.include('🔗 Shareable Link');
    });

    it('should add step to action exactly once', async () => {
      await exec(req, action);
      expect(action.addStep.calledOnce).to.be.true;
      expect(action.addStep.calledWithExactly(stepInstance)).to.be.true;
    });

    it('should return action instance', async () => {
      const result = await exec(req, action);
      expect(result).to.equal(action);
    });

    it('should handle https URL format', async () => {
      getServiceUIURLStub.returns('https://git-proxy-hosted-ui.com');
      await exec(req, action);

      const message = stepInstance.setAsyncBlock.firstCall.args[0];
      expect(message).to.include('https://git-proxy-hosted-ui.com/dashboard/push/push_123');
    });

    it('should handle special characters in action ID', async () => {
      action.id = 'push@special#chars!';
      await exec(req, action);

      const message = stepInstance.setAsyncBlock.firstCall.args[0];
      expect(message).to.include('/push/push@special#chars!');
    });
  });

  describe.only('fuzzing', () => {
    it('should handle all possible characters in action ID', () => {
      fc.assert(
        fc.property(fc.string(), (actionId) => {
          action.id = actionId;
          exec(req, action);
        })
      );
    });

    it('should create a step with correct parameters regardless of action ID', () => {
      fc.assert(
        fc.asyncProperty(fc.string(), async (actionId) => {
          action.id = actionId;

          const freshStepInstance = new Step('temp');
          const setAsyncBlockStub = sinon.stub(freshStepInstance, 'setAsyncBlock');

          const StepSpyLocal = sinon.stub().returns(freshStepInstance);
          const getServiceUIURLStubLocal = sinon.stub().returns('http://localhost:8080');

          const blockForAuth = proxyquire('../../src/proxy/processors/push-action/blockForAuth', {
            '../../../service/urls': { getServiceUIURL: getServiceUIURLStubLocal },
            '../../actions': { Step: StepSpyLocal }
          });

          const result = await blockForAuth.exec(req, action);

          expect(StepSpyLocal.calledOnce).to.be.true;
          expect(StepSpyLocal.calledWithExactly('authBlock')).to.be.true;
          expect(setAsyncBlockStub.calledOnce).to.be.true;

          const message = setAsyncBlockStub.firstCall.args[0];
          expect(message).to.include(`http://localhost:8080/dashboard/push/${actionId}`);
          expect(message).to.include('\x1B[32mGitProxy has received your push ✅\x1B[0m');
          expect(message).to.include(`\x1B[34mhttp://localhost:8080/dashboard/push/${actionId}\x1B[0m`);
          expect(message).to.include('🔗 Shareable Link');
          expect(result).to.equal(action);
        })
      );
    });  
  });
});
