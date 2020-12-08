// This test needs to run first
const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const service = require('../src/service');

chai.use(chaiHttp);
chai.should();

// Use this test as a template
describe('init', async () => {
  before(async function() {
    // sinon.stub(console, 'log');
    // sinon.stub(console, 'info');
    // sinon.stub(console, 'warn');
    // sinon.stub(console, 'error');
    app = await service.start();
  });

  it('should not be logged in', async function() {
    const res = await chai.request(app)
        .get('/auth/profile');

    res.should.have.status(401);
  });

  after(async function() {
    await service.httpServer.close();
  });
});
