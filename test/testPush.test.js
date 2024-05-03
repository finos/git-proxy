// Import the dependencies for testing
const chai = require('chai');
const chaiHttp = require('chai-http');
const db = require('../src/db');
const service = require('../src/service');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

describe('auth', async () => {
  let app;
  let cookie;

  before(async function () {
    app = await service.start();
    await db.deleteUser('login-test-user');

    const res = await chai.request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin',
    });

    expect(res).to.have.cookie('connect.sid');
    res.should.have.status(200);

    // Get the connect cooie
    res.headers['set-cookie'].forEach((x) => {
      if (x.startsWith('connect')) {
        cookie = x.split(';')[0];
      }
    });
  });

  describe('test push API', async function () {
    it('should get 404 for unknown push', async function () {
      const commitId =
        '0000000000000000000000000000000000000000__79b4d8953cbc324bcc1eb53d6412ff89666c241f'; // eslint-disable-line max-len
      const res = await chai
        .request(app)
        .get(`/api/v1/push/${commitId}`)
        .set('Cookie', `${cookie}`);
      res.should.have.status(404);
    });
  });

  after(async function () {
    const res = await chai.request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
    res.should.have.status(200);

    await service.httpServer.close();
  });
});
