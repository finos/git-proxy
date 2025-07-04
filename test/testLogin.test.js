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
  });

  describe('test login / logout', async function () {
    // Test to get all students record
    it('should get 401 not logged in', async function () {
      const res = await chai.request(app).get('/api/auth/profile');

      res.should.have.status(401);
    });

    it('should be able to login', async function () {
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

    it('should now be able to access the user login metadata', async function () {
      const res = await chai.request(app).get('/api/auth/me').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('should now be able to access the profile', async function () {
      const res = await chai.request(app).get('/api/auth/profile').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('should be able to set the git account', async function () {
      console.log(`cookie: ${cookie}`);
      const res = await chai.request(app).post('/api/auth/gitAccount')
        .set('Cookie', `${cookie}`)
        .send({
          username: 'admin',
          gitAccount: 'new-account',
        });
      res.should.have.status(200);
    });

    it('should throw an error if the username is not provided when setting the git account', async function () {
      const res = await chai.request(app).post('/api/auth/gitAccount')
        .set('Cookie', `${cookie}`)
        .send({
          gitAccount: 'new-account',
        });
      console.log(`res: ${JSON.stringify(res)}`);
      res.should.have.status(400);
    });

    it('should now be able to logout', async function () {
      const res = await chai.request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('test cannot access profile page', async function () {
      const res = await chai.request(app).get('/api/auth/profile').set('Cookie', `${cookie}`);

      res.should.have.status(401);
    });

    it('should fail to login with invalid username', async function () {
      const res = await chai.request(app).post('/api/auth/login').send({
        username: 'invalid',
        password: 'admin',
      });
      res.should.have.status(401);
    });

    it('should fail to login with invalid password', async function () {
      const res = await chai.request(app).post('/api/auth/login').send({
        username: 'admin',
        password: 'invalid',
      });
      res.should.have.status(401);
    });

    it('should fail to set the git account if the user is not logged in', async function () {
      const res = await chai.request(app).post('/api/auth/gitAccount').send({
        username: 'admin',
        gitAccount: 'new-account',
      });
      res.should.have.status(401);
    });

    it('should fail to get the current user metadata if not logged in', async function () {
      const res = await chai.request(app).get('/api/auth/me');
      res.should.have.status(401);
    });

    it('should fail to login with invalid credentials', async function () {
      const res = await chai.request(app).post('/api/auth/login').send({
        username: 'admin',
        password: 'invalid',
      });
      res.should.have.status(401);
    });
  });

  after(async function () {
    await service.httpServer.close();
  });
});
