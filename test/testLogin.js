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
    // Test to get all students record
    it('should get 401 not logged in', function(done) {
      chai.request(app)
          .get('/auth/profile')
          .end((err, res) => {
            res.should.have.status(401);
            done();
          });
    });

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

    it('should now be able to access the profile', function(done) {
      chai.request(app)
          .get('/auth/profile')
          .set('Cookie', `${cookie}`)
          .end((err, res) => {
            res.should.have.status(200);
            done();
          });
    });

    it('should now be able to logout', function(done) {
      chai.request(app)
          .post('/auth/logout')
          .set('Cookie', `${cookie}`)
          .end((err, res) => {
            res.should.have.status(200);
            done();
          });
    });

    it('test cannot access profile page', function(done) {
      chai.request(app)
          .get('/auth/profile')
          .set('Cookie', `${cookie}`)
          .end((err, res) => {
            res.should.have.status(401);
            done();
          });
    });
  });

  after(async function() {
    await service.httpServer.close();
  });
});
