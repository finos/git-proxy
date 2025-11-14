const fc = require('fast-check');
const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const { Step } = require('../../src/proxy/actions/Step');

chai.should();
const expect = chai.expect;

describe('captureSSHKey', () => {
  let action;
  let exec;
  let req;
  let stepInstance;
  let StepSpy;
  let addSSHKeyForPushStub;
  let encryptSSHKeyStub;

  beforeEach(() => {
    req = {
      protocol: 'ssh',
      headers: { host: 'example.com' },
    };

    action = {
      id: 'push_123',
      protocol: 'ssh',
      allowPush: false,
      sshUser: {
        username: 'test-user',
        email: 'test@example.com',
        gitAccount: 'testgit',
        sshKeyInfo: {
          keyType: 'ssh-rsa',
          keyData: Buffer.from('mock-key-data'),
        },
      },
      addStep: sinon.stub(),
    };

    stepInstance = new Step('captureSSHKey');
    sinon.stub(stepInstance, 'log');
    sinon.stub(stepInstance, 'setError');

    StepSpy = sinon.stub().returns(stepInstance);

    addSSHKeyForPushStub = sinon.stub().returns(true);
    encryptSSHKeyStub = sinon.stub().returns({
      encryptedKey: 'encrypted-key',
      expiryTime: new Date('2020-01-01T00:00:00Z'),
    });

    const captureSSHKey = proxyquire('../../src/proxy/processors/push-action/captureSSHKey', {
      '../../actions': { Step: StepSpy },
      '../../../service/SSHKeyForwardingService': {
        SSHKeyForwardingService: {
          addSSHKeyForPush: addSSHKeyForPushStub,
        },
      },
      '../../../security/SSHKeyManager': {
        SSHKeyManager: {
          encryptSSHKey: encryptSSHKeyStub,
        },
      },
    });

    exec = captureSSHKey.exec;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('exec', () => {
    describe('successful SSH key capture', () => {
      it('should create step with correct parameters', async () => {
        await exec(req, action);

        expect(StepSpy.calledOnce).to.be.true;
        expect(StepSpy.calledWithExactly('captureSSHKey')).to.be.true;
      });

      it('should log key capture for valid SSH push', async () => {
        await exec(req, action);

        expect(stepInstance.log.calledTwice).to.be.true;
        expect(stepInstance.log.firstCall.args[0]).to.equal(
          'Capturing SSH key for user test-user on push push_123',
        );
        expect(stepInstance.log.secondCall.args[0]).to.equal(
          'SSH key information stored for approval process',
        );
        expect(addSSHKeyForPushStub.calledOnce).to.be.true;
        expect(addSSHKeyForPushStub.firstCall.args[0]).to.equal('push_123');
        expect(Buffer.isBuffer(addSSHKeyForPushStub.firstCall.args[1])).to.be.true;
        expect(Buffer.isBuffer(addSSHKeyForPushStub.firstCall.args[2])).to.be.true;
        expect(encryptSSHKeyStub.calledOnce).to.be.true;
        expect(action.encryptedSSHKey).to.equal('encrypted-key');
        expect(action.sshKeyExpiry.toISOString()).to.equal('2020-01-01T00:00:00.000Z');
      });

      it('should set action user from SSH user', async () => {
        await exec(req, action);

        expect(action.user).to.equal('test-user');
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

      it('should handle SSH user with all optional fields', async () => {
        action.sshUser = {
          username: 'full-user',
          email: 'full@example.com',
          gitAccount: 'fullgit',
          sshKeyInfo: {
            keyType: 'ssh-ed25519',
            keyData: Buffer.from('ed25519-key-data'),
          },
        };

        const result = await exec(req, action);

        expect(result.user).to.equal('full-user');
        expect(stepInstance.log.firstCall.args[0]).to.include('full-user');
        expect(stepInstance.log.firstCall.args[0]).to.include('push_123');
      });

      it('should handle SSH user with minimal fields', async () => {
        action.sshUser = {
          username: 'minimal-user',
          sshKeyInfo: {
            keyType: 'ssh-rsa',
            keyData: Buffer.from('minimal-key-data'),
          },
        };

        const result = await exec(req, action);

        expect(result.user).to.equal('minimal-user');
        expect(stepInstance.log.firstCall.args[0]).to.include('minimal-user');
      });
    });

    describe('skip conditions', () => {
      it('should skip for non-SSH protocol', async () => {
        action.protocol = 'https';

        await exec(req, action);

        expect(stepInstance.log.calledOnce).to.be.true;
        expect(stepInstance.log.firstCall.args[0]).to.equal(
          'Skipping SSH key capture - not an SSH push requiring approval',
        );
        expect(action.user).to.be.undefined;
        expect(addSSHKeyForPushStub.called).to.be.false;
        expect(encryptSSHKeyStub.called).to.be.false;
      });

      it('should skip when no SSH user provided', async () => {
        action.sshUser = null;

        await exec(req, action);

        expect(stepInstance.log.calledOnce).to.be.true;
        expect(stepInstance.log.firstCall.args[0]).to.equal(
          'Skipping SSH key capture - not an SSH push requiring approval',
        );
        expect(action.user).to.be.undefined;
      });

      it('should skip when push is already allowed', async () => {
        action.allowPush = true;

        await exec(req, action);

        expect(stepInstance.log.calledOnce).to.be.true;
        expect(stepInstance.log.firstCall.args[0]).to.equal(
          'Skipping SSH key capture - not an SSH push requiring approval',
        );
        expect(action.user).to.be.undefined;
      });

      it('should skip when SSH user has no key info', async () => {
        action.sshUser = {
          username: 'no-key-user',
          email: 'nokey@example.com',
        };

        await exec(req, action);

        expect(stepInstance.log.calledOnce).to.be.true;
        expect(stepInstance.log.firstCall.args[0]).to.equal(
          'No SSH private key available for capture',
        );
        expect(action.user).to.be.undefined;
        expect(addSSHKeyForPushStub.called).to.be.false;
        expect(encryptSSHKeyStub.called).to.be.false;
      });

      it('should skip when SSH user has null key info', async () => {
        action.sshUser = {
          username: 'null-key-user',
          sshKeyInfo: null,
        };

        await exec(req, action);

        expect(stepInstance.log.calledOnce).to.be.true;
        expect(stepInstance.log.firstCall.args[0]).to.equal(
          'No SSH private key available for capture',
        );
        expect(action.user).to.be.undefined;
        expect(addSSHKeyForPushStub.called).to.be.false;
        expect(encryptSSHKeyStub.called).to.be.false;
      });

      it('should skip when SSH user has undefined key info', async () => {
        action.sshUser = {
          username: 'undefined-key-user',
          sshKeyInfo: undefined,
        };

        await exec(req, action);

        expect(stepInstance.log.calledOnce).to.be.true;
        expect(stepInstance.log.firstCall.args[0]).to.equal(
          'No SSH private key available for capture',
        );
        expect(action.user).to.be.undefined;
        expect(addSSHKeyForPushStub.called).to.be.false;
        expect(encryptSSHKeyStub.called).to.be.false;
      });

      it('should add step to action even when skipping', async () => {
        action.protocol = 'https';

        await exec(req, action);

        expect(action.addStep.calledOnce).to.be.true;
        expect(action.addStep.calledWithExactly(stepInstance)).to.be.true;
      });
    });

    describe('combined skip conditions', () => {
      it('should skip when protocol is not SSH and allowPush is true', async () => {
        action.protocol = 'https';
        action.allowPush = true;

        await exec(req, action);

        expect(stepInstance.log.calledOnce).to.be.true;
        expect(stepInstance.log.firstCall.args[0]).to.equal(
          'Skipping SSH key capture - not an SSH push requiring approval',
        );
      });

      it('should skip when protocol is SSH but no SSH user and allowPush is false', async () => {
        action.protocol = 'ssh';
        action.sshUser = null;
        action.allowPush = false;

        await exec(req, action);

        expect(stepInstance.log.calledOnce).to.be.true;
        expect(stepInstance.log.firstCall.args[0]).to.equal(
          'Skipping SSH key capture - not an SSH push requiring approval',
        );
      });

      it('should capture when protocol is SSH, has SSH user with key, and allowPush is false', async () => {
        action.protocol = 'ssh';
        action.allowPush = false;
        action.sshUser = {
          username: 'valid-user',
          sshKeyInfo: {
            keyType: 'ssh-rsa',
            keyData: Buffer.from('valid-key'),
          },
        };

        await exec(req, action);

        expect(stepInstance.log.calledTwice).to.be.true;
        expect(stepInstance.log.firstCall.args[0]).to.include('valid-user');
        expect(action.user).to.equal('valid-user');
      });
    });

    describe('error handling', () => {
      it('should handle errors gracefully when Step constructor throws', async () => {
        StepSpy.throws(new Error('Step creation failed'));

        // This will throw because the Step constructor is called at the beginning
        // and the error is not caught until the try-catch block
        try {
          await exec(req, action);
          expect.fail('Expected function to throw');
        } catch (error) {
          expect(error.message).to.equal('Step creation failed');
        }
      });

      it('should handle errors when action.addStep throws', async () => {
        action.addStep.throws(new Error('addStep failed'));

        // The error in addStep is not caught in the current implementation
        // so this test should expect the function to throw
        try {
          await exec(req, action);
          expect.fail('Expected function to throw');
        } catch (error) {
          expect(error.message).to.equal('addStep failed');
        }
      });

      it('should handle errors when setting action.user throws', async () => {
        // Make action.user a read-only property to simulate an error
        Object.defineProperty(action, 'user', {
          set: () => {
            throw new Error('Cannot set user property');
          },
          configurable: true,
        });

        const result = await exec(req, action);

        expect(stepInstance.setError.calledOnce).to.be.true;
        expect(stepInstance.setError.firstCall.args[0]).to.equal(
          'Failed to capture SSH key: Cannot set user property',
        );
        expect(result).to.equal(action);
      });

      it('should handle non-Error exceptions', async () => {
        stepInstance.log.throws('String error');

        const result = await exec(req, action);

        expect(stepInstance.setError.calledOnce).to.be.true;
        expect(stepInstance.setError.firstCall.args[0]).to.include('Failed to capture SSH key:');
        expect(result).to.equal(action);
      });

      it('should handle null error objects', async () => {
        stepInstance.log.throws(null);

        const result = await exec(req, action);

        expect(stepInstance.setError.calledOnce).to.be.true;
        expect(stepInstance.setError.firstCall.args[0]).to.include('Failed to capture SSH key:');
        expect(result).to.equal(action);
      });

      it('should add step to action even when error occurs', async () => {
        stepInstance.log.throws(new Error('log failed'));

        const result = await exec(req, action);

        // The step should still be added to action even when an error occurs
        expect(stepInstance.setError.calledOnce).to.be.true;
        expect(stepInstance.setError.firstCall.args[0]).to.equal(
          'Failed to capture SSH key: log failed',
        );
        expect(action.addStep.calledOnce).to.be.true;
        expect(result).to.equal(action);
      });
    });

    describe('edge cases and data validation', () => {
      it('should handle empty username', async () => {
        action.sshUser.username = '';

        const result = await exec(req, action);

        expect(result.user).to.equal('');
        expect(stepInstance.log.firstCall.args[0]).to.include(
          'Capturing SSH key for user  on push',
        );
      });

      it('should handle very long usernames', async () => {
        const longUsername = 'a'.repeat(1000);
        action.sshUser.username = longUsername;

        const result = await exec(req, action);

        expect(result.user).to.equal(longUsername);
        expect(stepInstance.log.firstCall.args[0]).to.include(longUsername);
      });

      it('should handle special characters in username', async () => {
        action.sshUser.username = 'user@domain.com!#$%';

        const result = await exec(req, action);

        expect(result.user).to.equal('user@domain.com!#$%');
        expect(stepInstance.log.firstCall.args[0]).to.include('user@domain.com!#$%');
      });

      it('should handle unicode characters in username', async () => {
        action.sshUser.username = 'ユーザー名';

        const result = await exec(req, action);

        expect(result.user).to.equal('ユーザー名');
        expect(stepInstance.log.firstCall.args[0]).to.include('ユーザー名');
      });

      it('should handle empty action ID', async () => {
        action.id = '';

        const result = await exec(req, action);

        expect(stepInstance.log.firstCall.args[0]).to.include('on push ');
        expect(result).to.equal(action);
      });

      it('should handle null action ID', async () => {
        action.id = null;

        const result = await exec(req, action);

        expect(stepInstance.log.firstCall.args[0]).to.include('on push null');
        expect(result).to.equal(action);
      });

      it('should handle undefined SSH user fields gracefully', async () => {
        action.sshUser = {
          username: undefined,
          email: undefined,
          gitAccount: undefined,
          sshKeyInfo: {
            keyType: 'ssh-rsa',
            keyData: Buffer.from('test-key'),
          },
        };

        const result = await exec(req, action);

        expect(result.user).to.be.undefined;
        expect(stepInstance.log.firstCall.args[0]).to.include('undefined');
      });
    });

    describe('key type variations', () => {
      it('should handle ssh-rsa key type', async () => {
        action.sshUser.sshKeyInfo.keyType = 'ssh-rsa';

        const result = await exec(req, action);

        expect(result.user).to.equal('test-user');
        expect(stepInstance.log.calledTwice).to.be.true;
      });

      it('should handle ssh-ed25519 key type', async () => {
        action.sshUser.sshKeyInfo.keyType = 'ssh-ed25519';

        const result = await exec(req, action);

        expect(result.user).to.equal('test-user');
        expect(stepInstance.log.calledTwice).to.be.true;
      });

      it('should handle ecdsa key type', async () => {
        action.sshUser.sshKeyInfo.keyType = 'ecdsa-sha2-nistp256';

        const result = await exec(req, action);

        expect(result.user).to.equal('test-user');
        expect(stepInstance.log.calledTwice).to.be.true;
      });

      it('should handle unknown key type', async () => {
        action.sshUser.sshKeyInfo.keyType = 'unknown-key-type';

        const result = await exec(req, action);

        expect(result.user).to.equal('test-user');
        expect(stepInstance.log.calledTwice).to.be.true;
      });

      it('should handle empty key type', async () => {
        action.sshUser.sshKeyInfo.keyType = '';

        const result = await exec(req, action);

        expect(result.user).to.equal('test-user');
        expect(stepInstance.log.calledTwice).to.be.true;
      });

      it('should handle null key type', async () => {
        action.sshUser.sshKeyInfo.keyType = null;

        const result = await exec(req, action);

        expect(result.user).to.equal('test-user');
        expect(stepInstance.log.calledTwice).to.be.true;
      });
    });

    describe('key data variations', () => {
      it('should handle small key data', async () => {
        action.sshUser.sshKeyInfo.keyData = Buffer.from('small');

        const result = await exec(req, action);

        expect(result.user).to.equal('test-user');
        expect(stepInstance.log.calledTwice).to.be.true;
      });

      it('should handle large key data', async () => {
        action.sshUser.sshKeyInfo.keyData = Buffer.alloc(4096, 'a');

        const result = await exec(req, action);

        expect(result.user).to.equal('test-user');
        expect(stepInstance.log.calledTwice).to.be.true;
      });

      it('should handle empty key data', async () => {
        action.sshUser.sshKeyInfo.keyData = Buffer.alloc(0);

        const result = await exec(req, action);

        expect(result.user).to.equal('test-user');
        expect(stepInstance.log.calledTwice).to.be.true;
      });

      it('should handle binary key data', async () => {
        action.sshUser.sshKeyInfo.keyData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);

        const result = await exec(req, action);

        expect(result.user).to.equal('test-user');
        expect(stepInstance.log.calledTwice).to.be.true;
      });
    });
  });

  describe('displayName', () => {
    it('should have correct displayName', () => {
      const captureSSHKey = require('../../src/proxy/processors/push-action/captureSSHKey');
      expect(captureSSHKey.exec.displayName).to.equal('captureSSHKey.exec');
    });
  });

  describe('fuzzing', () => {
    it('should handle random usernames without errors', () => {
      fc.assert(
        fc.asyncProperty(fc.string(), async (username) => {
          const testAction = {
            id: 'fuzz_test',
            protocol: 'ssh',
            allowPush: false,
            sshUser: {
              username: username,
              sshKeyInfo: {
                keyType: 'ssh-rsa',
                keyData: Buffer.from('test-key'),
              },
            },
            addStep: sinon.stub(),
          };

          const freshStepInstance = new Step('captureSSHKey');
          const logStub = sinon.stub(freshStepInstance, 'log');
          const setErrorStub = sinon.stub(freshStepInstance, 'setError');

          const StepSpyLocal = sinon.stub().returns(freshStepInstance);

          const captureSSHKey = proxyquire('../../src/proxy/processors/push-action/captureSSHKey', {
            '../../actions': { Step: StepSpyLocal },
          });

          const result = await captureSSHKey.exec(req, testAction);

          expect(StepSpyLocal.calledOnce).to.be.true;
          expect(StepSpyLocal.calledWithExactly('captureSSHKey')).to.be.true;
          expect(logStub.calledTwice).to.be.true;
          expect(setErrorStub.called).to.be.false;

          const firstLogMessage = logStub.firstCall.args[0];
          expect(firstLogMessage).to.include(
            `Capturing SSH key for user ${username} on push fuzz_test`,
          );
          expect(firstLogMessage).to.include('fuzz_test');

          expect(result).to.equal(testAction);
          expect(result.user).to.equal(username);
        }),
        {
          numRuns: 100,
        },
      );
    });

    it('should handle random action IDs without errors', () => {
      fc.assert(
        fc.asyncProperty(fc.string(), async (actionId) => {
          const testAction = {
            id: actionId,
            protocol: 'ssh',
            allowPush: false,
            sshUser: {
              username: 'fuzz-user',
              sshKeyInfo: {
                keyType: 'ssh-rsa',
                keyData: Buffer.from('test-key'),
              },
            },
            addStep: sinon.stub(),
          };

          const freshStepInstance = new Step('captureSSHKey');
          const logStub = sinon.stub(freshStepInstance, 'log');
          const setErrorStub = sinon.stub(freshStepInstance, 'setError');

          const StepSpyLocal = sinon.stub().returns(freshStepInstance);

          const captureSSHKey = proxyquire('../../src/proxy/processors/push-action/captureSSHKey', {
            '../../actions': { Step: StepSpyLocal },
          });

          const result = await captureSSHKey.exec(req, testAction);

          expect(StepSpyLocal.calledOnce).to.be.true;
          expect(logStub.calledTwice).to.be.true;
          expect(setErrorStub.called).to.be.false;

          const firstLogMessage = logStub.firstCall.args[0];
          expect(firstLogMessage).to.include(
            `Capturing SSH key for user fuzz-user on push ${actionId}`,
          );

          expect(result).to.equal(testAction);
          expect(result.user).to.equal('fuzz-user');
        }),
        {
          numRuns: 100,
        },
      );
    });

    it('should handle random protocol values', () => {
      fc.assert(
        fc.asyncProperty(fc.string(), async (protocol) => {
          const testAction = {
            id: 'fuzz_protocol',
            protocol: protocol,
            allowPush: false,
            sshUser: {
              username: 'protocol-user',
              sshKeyInfo: {
                keyType: 'ssh-rsa',
                keyData: Buffer.from('test-key'),
              },
            },
            addStep: sinon.stub(),
          };

          const freshStepInstance = new Step('captureSSHKey');
          const logStub = sinon.stub(freshStepInstance, 'log');
          const setErrorStub = sinon.stub(freshStepInstance, 'setError');

          const StepSpyLocal = sinon.stub().returns(freshStepInstance);

          const captureSSHKey = proxyquire('../../src/proxy/processors/push-action/captureSSHKey', {
            '../../actions': { Step: StepSpyLocal },
          });

          const result = await captureSSHKey.exec(req, testAction);

          expect(StepSpyLocal.calledOnce).to.be.true;
          expect(setErrorStub.called).to.be.false;

          if (protocol === 'ssh') {
            // Should capture
            expect(logStub.calledTwice).to.be.true;
            expect(result.user).to.equal('protocol-user');
          } else {
            // Should skip
            expect(logStub.calledOnce).to.be.true;
            expect(logStub.firstCall.args[0]).to.equal(
              'Skipping SSH key capture - not an SSH push requiring approval',
            );
            expect(result.user).to.be.undefined;
          }

          expect(result).to.equal(testAction);
        }),
        {
          numRuns: 50,
        },
      );
    });
  });
});
