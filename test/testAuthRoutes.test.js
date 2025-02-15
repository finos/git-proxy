// Import the dependencies for testing
const chai = require('chai');
const chaiHttp = require('chai-http');
const db = require('../src/db');
const service = require('../src/service');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

describe('Test Auth Routes', async () => {
  let app;
  let cookie;

  before(async function () {
    app = await service.start();
    await db.deleteUser('login-test-user');
  });

  describe('test GET / method', async function () {
    it('should return auth endpoints', async function () {
      const res = await chai.request(app)
        .get('/api/auth');

      expect(res.status).to.be.equal(200);
      expect(res.body).to.deep.equal({
        login: {
          action: 'post',
          uri: '/api/auth/login',
        },
        profile: {
          action: 'get',
          uri: '/api/auth/profile',
        },
        logout: {
          action: 'post',
          uri: '/api/auth/logout',
        }
      });
    })
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

    it('should now return success', async function () {
      const res = await chai.request(app).get('/api/auth/success').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('should now be able to access the user login metadata', async function () {
      const res = await chai.request(app).get('/api/auth/userLoggedIn').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('should now be able to access the profile', async function () {
      const res = await chai.request(app).get('/api/auth/profile').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('should now be able to add git account to user', async function () {
      const userAccount = { "username": "admin", "gitAccount": "test", "email": "test@test.com", "admin": true };

      const res = await chai.request(app)
        .post('/api/auth/gitAccount')
        .set('Cookie', `${cookie}`)
        .send({
          username: 'admin',
          gitAccount: userAccount
        });
      res.should.have.status(200);
    });

    it('should get error when user id/name is not sent in req.bosy', async function () {
      const userAccount = { "username": "admin", "gitAccount": "test", "email": "test@test.com", "admin": true };

      const res = await chai.request(app)
        .post('/api/auth/gitAccount')
        .set('Cookie', `${cookie}`)
        .send({
          gitAccount: userAccount
        });
      res.should.have.status(500);
    });


    it('should now be able to logout', async function () {
      const res = await chai.request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('should not get login success', async function () {
      const res = await chai.request(app).get('/api/auth/success').set('Cookie', `${cookie}`);
      res.should.have.status(401);
    });

    it('should not be able to add git account without login', async function () {
      const userAccount = { "username": "admin", "gitAccount": "test", "email": "test@test.com", "admin": true };

      const res = await chai.request(app)
        .post('/api/auth/gitAccount')
        .set('Cookie', `${cookie}`)
        .send({
          username: 'admin',
          gitAccount: userAccount
        });
      res.should.have.status(401);
    });

    it('test cannot access profile page', async function () {
      const res = await chai.request(app).get('/api/auth/profile').set('Cookie', `${cookie}`);

      res.should.have.status(401);
    });

    it('test cannot get login status', async function () {
      const res = await chai.request(app).get('/api/auth/userLoggedIn').set('Cookie', `${cookie}`);

      res.should.have.status(401);
    });
  });

  after(async function () {
    await service.httpServer.close();
  });
});
