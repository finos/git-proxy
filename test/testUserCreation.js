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

  before(async function() {
    app = await service.start();
    await db.deleteUser('login-test-user');
  });

  describe('test login / logout', function() {
    it('should be able to login', function(done) {
      chai.request(app)
          .post('/auth/login')
          .send({
            username: 'admin',
            password: 'admin',
          })
          .end((err, res) => {
            expect(res).to.have.cookie('connect.sid');
            res.should.have.status(200);

            // Get the connect cooie
            res.headers['set-cookie'].forEach((x) => {
              if (x.startsWith('connect')) {
                cookie = x.split(';')[0];
              }
            });
            done();
          });
    });

    it('should be able to create a new user', function(done) {
      chai.request(app)
          .post('/auth/profile')
          .set('Cookie', `${cookie}`)
          .send({
            username: 'login-test-user',
            email: 'login-test-user@somedomain.com',
            admin: true,
            canPush: true,
            canPull: true,
            canAuthorise: true,
          })
          .end((err, res) => {
            res.should.have.status(200);
            done();
          });
    });

    it('logout', function(done) {
      chai.request(app)
          .post('/auth/logout').set('Cookie', `${cookie}`)
          .end((err, res) => {
            res.should.have.status(200);
            done();
          });
    });
  });

  after(async function() {
    await service.httpServer.close();
  });
});
