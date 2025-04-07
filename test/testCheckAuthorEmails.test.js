const { exec } = require('../src/proxy/processors/push-action/checkAuthorEmails');  // Import exec function

const assert = require('assert'); // Use Node.js assert module for assertions

describe('checkAuthorEmails', () => {
  let action;

  // Before each test, set up mock data for action and req
  beforeEach(() => {
    action = {
      commitData: [
        { authorEmail: 'valid.email@example.com' },
        { authorEmail: 'blockedUser@example.com' },
        { authorEmail: 'user@blocked-domain.com' },
        { authorEmail: 'invalid.email@' },
        { authorEmail: 'invalidemail.com' },
        { authorEmail: '' },
        { authorEmail: null },
        { authorEmail: undefined },
      ],
      addStep: function () { this.calls.push('addStep called'); },  // Mock the addStep function with a call counter
      calls: []  // Array to track calls to addStep
    };
  });

  it('should return true for a valid email', async () => {
    const req = {};  // Mock request object
    const result = await exec(req, action);  // Execute the function
    // Check that addStep was called (simulating a step addition)
    assert.strictEqual(result.calls.length, 1, 'addStep should have been called once');
  });

  it('should return false for an invalid email with no domain', async () => {
    const req = {};  // Mock request object
    action.commitData[3] = { authorEmail: 'invalid.email@' };  // Invalid email with no domain
    const result = await exec(req, action);
    assert.strictEqual(result.calls.length, 1, 'addStep should have been called once');
  });

  it('should return false for an invalid email with no "@" symbol', async () => {
    const req = {};
    action.commitData[4] = { authorEmail: 'invalidemail.com' };  // Invalid email with no '@'
    const result = await exec(req, action);
    assert.strictEqual(result.calls.length, 1, 'addStep should have been called once');
  });

  it('should return false for an email with a forbidden username', async () => {
    const req = {};
    action.commitData[1] = { authorEmail: 'blockedUser@example.com' };  // Email with blocked username
    const result = await exec(req, action);
    assert.strictEqual(result.calls.length, 1, 'addStep should have been called once');
  });

  it('should return false for an email with a forbidden domain', async () => {
    const req = {};
    action.commitData[2] = { authorEmail: 'user@blocked-domain.com' };  // Email with blocked domain
    const result = await exec(req, action);
    assert.strictEqual(result.calls.length, 1, 'addStep should have been called once');
  });

  it('should return false for an empty email string', async () => {
    const req = {};
    action.commitData[5] = { authorEmail: '' };  // Empty email string
    const result = await exec(req, action);
    assert.strictEqual(result.calls.length, 1, 'addStep should have been called once');
  });

  it('should return false for a null email', async () => {
    const req = {};
    action.commitData[6] = { authorEmail: null };  // Null email
    const result = await exec(req, action);
    assert.strictEqual(result.calls.length, 1, 'addStep should have been called once');
  });

  it('should return false for an undefined email', async () => {
    const req = {};
    action.commitData[7] = { authorEmail: undefined };  // Undefined email
    const result = await exec(req, action);
    assert.strictEqual(result.calls.length, 1, 'addStep should have been called once');
  });
});
