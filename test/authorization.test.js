// Import the dependencies for testing
const chai = require('chai');
const chaiHttp = require('chai-http');
const db = require('../src/db');
const service = require('../src/service');
const { isAdmin, isAuthenticated } = require('../src/service/middleware/authorization');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

describe('Authorization Middleware', () => {
  describe('isAuthenticated middleware', () => {
    it('should return 401 if user is not authenticated', () => {
      const req = { isAuthenticated: () => false };
      const res = {
        status: function(code) {
          expect(code).to.equal(401);
          return this;
        },
        json: function(data) {
          expect(data.message).to.equal('Unauthorized');
          return this;
        }
      };
      const next = () => {
        throw new Error('next should not be called');
      };
      
      isAuthenticated(req, res, next);
    });

    it('should call next if user is authenticated', () => {
      const req = { isAuthenticated: () => true };
      const res = {};
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };
      
      isAuthenticated(req, res, next);
      expect(nextCalled).to.be.true;
    });
  });

  describe('isAdmin middleware', () => {
    it('should return 401 if user is not authenticated', () => {
      const req = { isAuthenticated: () => false };
      const res = {
        status: function(code) {
          expect(code).to.equal(401);
          return this;
        },
        json: function(data) {
          expect(data.message).to.equal('Unauthorized');
          return this;
        }
      };
      const next = () => {
        throw new Error('next should not be called');
      };
      
      isAdmin(req, res, next);
    });

    it('should return 403 if user is authenticated but not admin', () => {
      const req = { 
        isAuthenticated: () => true,
        user: { isAdmin: false }
      };
      const res = {
        status: function(code) {
          expect(code).to.equal(403);
          return this;
        },
        json: function(data) {
          expect(data.message).to.equal('Forbidden');
          return this;
        }
      };
      const next = () => {
        throw new Error('next should not be called');
      };
      
      isAdmin(req, res, next);
    });

    it('should call next if user is authenticated and admin', () => {
      const req = { 
        isAuthenticated: () => true,
        user: { admin: true }
      };
      const res = {
        status: function() { return this; },
        json: function() { return this; }
      };
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };
      
      isAdmin(req, res, next);
      expect(nextCalled).to.be.true;
    });
  });
});

describe('API routes with authorization', () => {
  let app;
  let adminCookie;
  let userCookie;

  before(async () => {
    // Increase timeout for setup
    app = await service.start();
    // Create test users
    await db.deleteUser('admin-test');
    await db.deleteUser('user-test');
    await db.createUser('admin-test', 'password', 'admin@test.com', 'admin-test', true);
    await db.createUser('user-test', 'password', 'user@test.com', 'user-test', false);
  });

  it('should login as admin', async function() {
    const res = await chai.request(app).post('/api/auth/login').send({
      username: 'admin-test',
      password: 'password'
    });
    
    expect(res).to.have.cookie('connect.sid');
    res.should.have.status(200);
    
    res.headers['set-cookie'].forEach((x) => {
      if (x.startsWith('connect')) {
        adminCookie = x.split(';')[0];
      }
    });
  });

  it('should login as regular user', async function() {
    const res = await chai.request(app).post('/api/auth/login').send({
      username: 'user-test',
      password: 'password'
    });
    
    expect(res).to.have.cookie('connect.sid');
    res.should.have.status(200);
    
    res.headers['set-cookie'].forEach((x) => {
      if (x.startsWith('connect')) {
        userCookie = x.split(';')[0];
      }
    });
  });

  it('should allow admin to access admin routes', async function() {
    const res = await chai.request(app).get('/api/v1/admin/users').set('Cookie', `${adminCookie}`);
    res.should.have.status(200);
  });

  it('should not allow regular user to access admin routes', async function() {
    const res = await chai.request(app).get('/api/v1/admin/users').set('Cookie', `${userCookie}`);
    res.should.have.status(403);
  });

  it('should not allow unauthenticated user to access admin routes', async function() {
    const res = await chai.request(app).get('/api/v1/admin/users');
    res.should.have.status(401);
  });

  after(async () => {
    // Increase timeout for cleanup
    await db.deleteUser('admin-test');
    await db.deleteUser('user-test');
    await service.httpServer.close();
  });
});
