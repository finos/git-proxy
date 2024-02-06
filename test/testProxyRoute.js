
const handleMessage = require('../src/proxy/routes').handleMessage;
const chai = require('chai');

const expect = chai.expect;

// Use this test as a template
describe('proxy error messages', async () => {

  it('should handle short messages', async function () {
    const res = await handleMessage('one');
    expect(res).to.contain('one');
  });

  it('should handle emoji messages', async function () {
    const res = await handleMessage('❌ push failed: too many errors');
    expect(res).to.contain('❌');
  });
});
