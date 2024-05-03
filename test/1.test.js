// This test needs to run first
const chai = require('chai');
const chaiHttp = require('chai-http');
const service = require('../src/service');

chai.use(chaiHttp);
chai.should();

// Use this test as a template
describe('init', async () => {
  let app;
  before(async function () {
    app = await service.start();
  });

  it('should not be logged in', async function () {
    const res = await chai.request(app).get('/api/auth/profile');

    res.should.have.status(401);
  });

  after(async function () {
    await service.httpServer.close();
  });
});
