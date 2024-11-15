const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const db = require('../src/db');
const service = require('../src/service');

chai.use(chaiHttp);
chai.should();
const { expect } = chai;

describe('Push Routes', function () {
  let app;
  let cookie;

  before(async function () {
    // Start the service and clean up test data
    app = await service.start();
    await db.deleteUser('login-test-user');

    // Login to get session cookie
    const res = await chai.request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin',
    });

    expect(res).to.have.cookie('connect.sid');
    cookie = res.headers['set-cookie'].find((x) => x.startsWith('connect.sid'));
    expect(res.status).to.equal(200);

    // Get the connect cookie
    res.headers['set-cookie'].forEach((x) => {
      if (x.startsWith('connect')) {
        cookie = x.split(";")[0];
      }
    });
  })

  after(async function () {
    // Logout and stop the service
    const res = await chai.request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
    res.should.have.status(200);
    await service.httpServer.close();
  });

  afterEach(function () {
    sinon.restore(); // Restore stubs after each test
  });

  describe('GET /push', function () {
    it('should return pushes with query parameters', async function () {
      sinon.stub(db, 'getPushes').resolves([{ id: 1, type: 'push' }]);

      const res = await chai
        .request(app)
        .get('/api/v1/push')
        .query({ limit: 10, skip: 0, active: 'true' });

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal([{ id: 1, type: 'push' }]);
    });
  });

  describe('GET /push/:id', function () {
    it('should return a push by ID', async function () {
      sinon.stub(db, 'getPush').resolves({ id: 1, type: 'push' });

      const res = await chai.request(app).get('/api/v1/push/1');

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({ id: 1, type: 'push' });
    });

    it('should return 404 if push not found', async function () {
      sinon.stub(db, 'getPush').resolves(null);

      const res = await chai.request(app).get('/api/v1/push/1');

      expect(res.status).to.equal(404);
      expect(res.body.message).to.equal('not found');
    });
  });

  describe('POST /push/:id/reject', function () {
    it('should reject a push request', async function () {
      sinon.stub(db, 'getPush').resolves({ id: 1, user: 'author' });
      sinon.stub(db, 'getUsers').resolves([{ username: ' author', admin: false }]);
      sinon.stub(db, 'canUserApproveRejectPush').resolves(true);
      sinon.stub(db, 'reject').resolves({ success: true });

      const res = await chai
        .request(app)
        .post('/api/v1/push/1/reject')
        .set('Cookie', cookie);

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({ success: true });
    });

    it('should return 401 if user is not logged in', async function () {
      const res = await chai.request(app).post('/api/v1/push/1/reject');
      expect(res.status).to.equal(401);
      expect(res.body).to.deep.equal({ message: 'not logged in' });
    });

    it('should return 401 if user is the author and not admin', async function () {
      sinon.stub(db, 'getPush').resolves({ id: 1, user: 'admin' });
      sinon.stub(db, 'getUsers').resolves([{ username: 'admin', admin: false }]);

      const res = await chai
        .request(app)
        .post('/api/v1/push/1/reject')
        .set('Cookie', cookie);

      expect(res.status).to.equal(401);
      expect(res.body).to.deep.equal({ message: 'Cannot reject your own changes' });
    });

    it('should return 401 if user is unauthorised to reject', async function () {
      sinon.stub(db, 'getPush').resolves({ id: 1, user: 'author' });
      sinon.stub(db, 'getUsers').resolves([{ username: 'author', admin: false }]);
      sinon.stub(db, 'canUserApproveRejectPush').resolves(false);

      const res = await chai
        .request(app)
        .post('/api/v1/push/1/reject')
        .set('Cookie', cookie);

      expect(res.status).to.equal(401);
      expect(res.body.message).to.equal('User is not authorised to reject changes');
    });
  });

  describe('POST /push/:id/authorise', function () {
    it('should authorise a push request', async function () {
      sinon.stub(db, 'getPush').resolves({ id: 1, user: 'user1' });
      sinon.stub(db, 'getUsers').resolves([{ username: 'userl', gitAccount: 'userl', admin: false }])
      sinon.stub(db, 'canUserApproveRejectPush').resolves(true);
      sinon.stub(db, 'authorise').resolves({ success: true });

      const res = await chai
        .request(app)
        .post('/api/v1/push/1/authorise')
        .set('Cookie', cookie)
        .send({ params: { attestation: [{ checked: true }] } });

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({ success: true });
    });

    it('should return 401 if user is not logged in', async () => {
      const res = await chai.request(app).post('/api/v1/push/1/authorise');
      expect(res.status).to.be.equal(401);
      expect(res.body).to.deep.equal({ message: 'You are unauthorized to perform this action...' });
    });

    it('should return 401 if attestation is incomplete', async () => {
      const res = await chai
        .request(app)
        .post('/api/v1/push/1/authorise')
        .set('Cookie', cookie)
        .send({ params: { attestation: [{ checked: false }] } });
      expect(res.status).to.be.equal(401);
      expect(res.body).to.deep.equal({ message: 'You are unauthorized to perform this action...' });
    });

    it('should return 401 if user is the author and not admin', async function () {
      sinon.stub(db, 'getPush').resolves({ id: 1, user: 'admin' });
      sinon.stub(db, 'getUsers').resolves([{ username: 'admin', admin: false }]);

      const res = await chai
        .request(app)
        .post('/api/v1/push/1/authorise')
        .set('Cookie', cookie)
        .send({ params: { attestation: [{ checked: true }] } });

      expect(res.status).to.be.equal(401);
      expect(res.body).to.deep.equal({ message: 'Cannot approve your own changes' });
    });


    it('should return 401 if user is unauthorised to authorise', async function () {
      sinon.stub(db, 'getPush').resolves({ id: 1, user: 'user1' });
      sinon.stub(db, 'getUsers').resolves([{ username: 'author', admin: false }]);
      sinon.stub(db, 'canUserApproveRejectPush').resolves(false);

      const res = await chai
        .request(app)
        .post('/api/v1/push/1/authorise')
        .set('Cookie', cookie)
        .send({ params: { attestation: [{ checked: true }] } });

      expect(res.status).to.equal(401);
      expect(res.body.message).to.equal("user admin not authorised to approve push's on this project");
    });

    it('should return 401 if user has no associated GitHub account', async () => {
      sinon.stub(db, 'getPush').resolves({ id: 1, user: 'author' });
      sinon.stub(db, 'getUsers').resolves([{ username: 'author', admin: false }]);
      sinon.stub(db, 'canUserApproveRejectPush').resolves(true);

      const res = await chai
        .request(app)
        .post('/api/v1/push/1/authorise')
        .set('Cookie', cookie)
        .send({ params: { attestation: [{ checked: true }] } });

      expect(res.status).to.be.equal(401);
      expect(res.body).to.deep.equal({
        message: 'You must associate a GitHub account with your user before approving...',
      });
    });


  });

  describe('POST /push/:id/cancel', function () {
    it('should cancel a push request', async function () {
      sinon.stub(db, 'canUserCancelPush').resolves(true);
      sinon.stub(db, 'cancel').resolves({ success: true });

      const res = await chai
        .request(app)
        .post('/api/v1/push/1/cancel')
        .set('Cookie', cookie);

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({ success: true });
    });

    it('should return 401 if user is not logged in', async () => {
      const res = await chai
        .request(app)
        .post('/api/v1/push/1/cancel');

      expect(res.status).to.be.equal(401);
      expect(res.body).to.deep.equal({ message: 'not logged in' });
    });


    it('should return 401 if user is unauthorised to cancel', async function () {
      sinon.stub(db, 'canUserCancelPush').resolves(false);

      const res = await chai
        .request(app)
        .post('/api/v1/push/1/cancel')
        .set('Cookie', cookie);

      expect(res.status).to.equal(401);
      expect(res.body).to.deep.equal({ message: 'User admin not authorised to cancel push requests on this project.' });
    });
  });
})
