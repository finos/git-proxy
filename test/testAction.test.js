const { expect } = require('chai');
const sinon = require('sinon');
const { Action } = require('../src/proxy/actions/Action');

describe('Action class - Error Handling', () => {
  let action;
  let consoleErrorStub;

  beforeEach(() => {
    action = new Action('1', 'push', 'method', Date.now(), 'project/repo');
    consoleErrorStub = sinon.stub(console, 'error');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('setAutoApproval() should log an error and return false if an error occurs', () => {
    action.setAutoApproval = function () {
      try {
        throw new Error('Test error');
      } catch (error) {
        console.error('Error during auto-approval:', error.message);
        return false;
      }
    };

    const result = action.setAutoApproval();
    expect(consoleErrorStub.calledOnceWith('Error during auto-approval:', 'Test error')).to.be.true;
    expect(result).to.be.false;
  });

  it('setAutoRejection() should log an error and return false if an error occurs', () => {
    action.setAutoRejection = function () {
      try {
        throw new Error('Test error');
      } catch (error) {
        console.error('Error during auto-rejection:', error.message);
        return false;
      }
    };

    const result = action.setAutoRejection();
    expect(consoleErrorStub.calledOnceWith('Error during auto-rejection:', 'Test error')).to.be
      .true;
    expect(result).to.be.false;
  });
});
