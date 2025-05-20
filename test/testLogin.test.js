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
      const res = await chai.request(app).get('/api/auth/userLoggedIn').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('should now be able to access the profile', async function () {
      const res = await chai.request(app).get('/api/auth/profile').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('should now be able to logout', async function () {
      const res = await chai.request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('test cannot access profile page', async function () {
      const res = await chai.request(app).get('/api/auth/profile').set('Cookie', `${cookie}`);

      res.should.have.status(401);
    });
  });

  describe('test create user', async function () {
    beforeEach(async function () {
      await db.deleteUser('newuser');
      await db.deleteUser('nonadmin');
    });

    it('should fail to create user when not authenticated', async function () {
      const res = await chai.request(app).post('/api/auth/create-user').send({
        username: 'newuser',
        password: 'newpass',
        email: 'new@email.com',
        gitAccount: 'newgit',
      });

      res.should.have.status(401);
      res.body.should.have
        .property('message')
        .eql('You are not authorized to perform this action...');
    });

    it('should fail to create user when not admin', async function () {
      await db.deleteUser('nonadmin');
      await db.createUser('nonadmin', 'nonadmin', 'nonadmin@test.com', 'nonadmin', false);

      // First login as non-admin user
      const loginRes = await chai.request(app).post('/api/auth/login').send({
        username: 'nonadmin',
        password: 'nonadmin',
      });

      loginRes.should.have.status(200);

      let nonAdminCookie;
      // Get the connect cooie
      loginRes.headers['set-cookie'].forEach((x) => {
        if (x.startsWith('connect')) {
          nonAdminCookie = x.split(';')[0];
        }
      });

      console.log('nonAdminCookie', nonAdminCookie);

      const res = await chai
        .request(app)
        .post('/api/auth/create-user')
        .set('Cookie', nonAdminCookie)
        .send({
          username: 'newuser',
          password: 'newpass',
          email: 'new@email.com',
          gitAccount: 'newgit',
        });

      res.should.have.status(401);
      res.body.should.have
        .property('message')
        .eql('You are not authorized to perform this action...');
    });

    it('should fail to create user with missing required fields', async function () {
      // First login as admin
      const loginRes = await chai.request(app).post('/api/auth/login').send({
        username: 'admin',
        password: 'admin',
      });

      const adminCookie = loginRes.headers['set-cookie'][0].split(';')[0];

      const res = await chai
        .request(app)
        .post('/api/auth/create-user')
        .set('Cookie', adminCookie)
        .send({
          username: 'newuser',
          // missing password
          email: 'new@email.com',
          gitAccount: 'newgit',
        });

      res.should.have.status(400);
      res.body.should.have
        .property('message')
        .eql('Missing required fields: username, password, email, and gitAccount are required');
    });

    it('should successfully create a new user', async function () {
      // First login as admin
      const loginRes = await chai.request(app).post('/api/auth/login').send({
        username: 'admin',
        password: 'admin',
      });

      const adminCookie = loginRes.headers['set-cookie'][0].split(';')[0];

      const res = await chai
        .request(app)
        .post('/api/auth/create-user')
        .set('Cookie', adminCookie)
        .send({
          username: 'newuser',
          password: 'newpass',
          email: 'new@email.com',
          gitAccount: 'newgit',
          admin: false,
        });

      res.should.have.status(201);
      res.body.should.have.property('message').eql('User created successfully');
      res.body.should.have.property('username').eql('newuser');

      // Verify we can login with the new user
      const newUserLoginRes = await chai.request(app).post('/api/auth/login').send({
        username: 'newuser',
        password: 'newpass',
      });

      newUserLoginRes.should.have.status(200);
    });

    it('should fail to create user when username already exists', async function () {
      // First login as admin
      const loginRes = await chai.request(app).post('/api/auth/login').send({
        username: 'admin',
        password: 'admin',
      });

      const adminCookie = loginRes.headers['set-cookie'][0].split(';')[0];

      const res = await chai
        .request(app)
        .post('/api/auth/create-user')
        .set('Cookie', adminCookie)
        .send({
          username: 'newuser',
          password: 'newpass',
          email: 'new@email.com',
          gitAccount: 'newgit',
          admin: false,
        });

      res.should.have.status(201);

      // Verify we can login with the new user
      const failCreateRes = await chai
        .request(app)
        .post('/api/auth/create-user')
        .set('Cookie', adminCookie)
        .send({
          username: 'newuser',
          password: 'newpass',
          email: 'new@email.com',
          gitAccount: 'newgit',
          admin: false,
        });

      failCreateRes.should.have.status(400);
    });
  });

  after(async function () {
    await service.httpServer.close();
  });
});
