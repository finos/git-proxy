const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const { Action, Step } = require('../../src/proxy/actions');
const fc = require('fast-check');

chai.should();
const expect = chai.expect;

describe('checkCommitMessages', () => {
  let commitConfig;
  let exec;
  let getCommitConfigStub;
  let logStub;

  beforeEach(() => {
    logStub = sinon.stub(console, 'log');

    commitConfig = {
      message: {
        block: {
          literals: ['secret', 'password'],
          patterns: ['\\b\\d{4}-\\d{4}-\\d{4}-\\d{4}\\b'] // Credit card pattern
        }
      }
    };

    getCommitConfigStub = sinon.stub().returns(commitConfig);

    const checkCommitMessages = proxyquire('../../src/proxy/processors/push-action/checkCommitMessages', {
      '../../../config': { getCommitConfig: getCommitConfigStub }
    });

    exec = checkCommitMessages.exec;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('exec', () => {
    let action;
    let req;
    let stepSpy;

    beforeEach(() => {
      req = {};
      action = new Action(
        '1234567890',
        'push',
        'POST',
        1234567890,
        'test/repo'
      );
      action.commitData = [
        { message: 'Fix bug', author: 'test@example.com' },
        { message: 'Update docs', author: 'test@example.com' }
      ];
      stepSpy = sinon.spy(Step.prototype, 'log');
    });

    it('should allow commit with valid messages', async () => {
      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.false;
      expect(logStub.calledWith('The following commit messages are legal: Fix bug,Update docs')).to.be.true;
    });

    it('should block commit with illegal messages', async () => {
      action.commitData?.push({ message: 'secret password here', author: 'test@example.com' });

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(stepSpy.calledWith(
        'The following commit messages are illegal: secret password here'
      )).to.be.true;
      expect(result.steps[0].errorMessage).to.include('Your push has been blocked');
      expect(logStub.calledWith('The following commit messages are illegal: secret password here')).to.be.true;
    });

    it('should handle duplicate messages only once', async () => {
      action.commitData = [
        { message: 'secret', author: 'test@example.com' },
        { message: 'secret', author: 'test@example.com' },
        { message: 'password', author: 'test@example.com' }
      ];

      const result = await exec(req, action);

      expect(result.steps[0].error).to.be.true;
      expect(stepSpy.calledWith(
        'The following commit messages are illegal: secret,password'
      )).to.be.true;
      expect(logStub.calledWith('The following commit messages are illegal: secret,password')).to.be.true;
    });

    it('should not error when commit data is empty', async () => {
      // Empty commit data is a valid scenario that happens when making a branch from an unapproved commit
      // This is remedied in the getMissingData.exec action  
      action.commitData = [];
      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.false;
      expect(logStub.calledWith('The following commit messages are legal: ')).to.be.true;
    });

    it('should handle commit data with null values', async () => {
      action.commitData = [
        { message: null, author: 'test@example.com' },
        { message: undefined, author: 'test@example.com' }
      ];

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
    });

    it('should handle commit messages of incorrect type', async () => {
      action.commitData = [
        { message: 123, author: 'test@example.com' },
        { message: {}, author: 'test@example.com' }
      ];

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(stepSpy.calledWith(
        'The following commit messages are illegal: 123,[object Object]'
      )).to.be.true;
      expect(logStub.calledWith('The following commit messages are illegal: 123,[object Object]')).to.be.true;
    });

    it('should handle a mix of valid and invalid messages', async () => {
      action.commitData = [
        { message: 'Fix bug', author: 'test@example.com' },
        { message: 'secret password here', author: 'test@example.com' }
      ];

      const result = await exec(req, action);

      expect(result.steps).to.have.lengthOf(1);
      expect(result.steps[0].error).to.be.true;
      expect(stepSpy.calledWith(
        'The following commit messages are illegal: secret password here'
      )).to.be.true;
      expect(logStub.calledWith('The following commit messages are illegal: secret password here')).to.be.true;
    });

    describe('fuzzing', () => {
      it('should not crash on arbitrary commit messages', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(
              fc.record({
                message: fc.oneof(
                  fc.string(),
                  fc.constant(null),
                  fc.constant(undefined),
                  fc.integer(),
                  fc.double(),
                  fc.boolean(),
                  fc.object(),
                ),
                author: fc.string()
              }),
              { maxLength: 20 }
            ),
            async (fuzzedCommits) => {
              const fuzzAction = new Action(
                'fuzz',
                'push',
                'POST',
                Date.now(),
                'fuzz/repo'
              );
              fuzzAction.commitData = Array.isArray(fuzzedCommits) ? fuzzedCommits : [];
      
              const result = await exec({}, fuzzAction);
      
              expect(result).to.have.property('steps');
              expect(result.steps[0]).to.have.property('error').that.is.a('boolean');
            }
          ),
          {
            examples: [
              [{ message: '', author: 'me' }],
              [{ message: '1234-5678-9012-3456', author: 'me' }],
              [{ message: null, author: 'me' }],
              [{ message: {}, author: 'me' }],
              [{ message: 'SeCrEt', author: 'me' }]
            ]
          }
        );
      });
    });
  });
});
