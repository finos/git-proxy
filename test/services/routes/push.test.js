const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const express = require('express');
const proxyquire = require('proxyquire');

const { expect } = chai;
chai.use(chaiHttp);

describe('Push API', () => {
  let app;
  let dbStub;
  let pushRouter;

  const mockPush = {
    id: 'push-id-123',
    type: 'push',
    url: 'https://github.com/test/repo.git',
    userEmail: 'committer@example.com',
    user: 'testcommitter',
    cancelled: false,
    rejected: false,
    authorised: false,
  };

  const createApp = (username) => {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    if (username) {
      app.use((req, res, next) => {
        req.user = { username };
        next();
      });
    }

    app.use('/push', pushRouter);
    return app;
  };

  beforeEach(() => {
    dbStub = {
      getPush: sinon.stub(),
      getUsers: sinon.stub(),
      canCancelPush: sinon.stub(),
      cancel: sinon.stub(),
      canUserApproveRejectPush: sinon.stub(),
      reject: sinon.stub(),
    };

    pushRouter = proxyquire('../../../src/service/routes/push', {
      '../../db': dbStub,
    }).default;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('POST /:id/reject', () => {
    it('should return 401 if user is not logged in', async () => {
      app = createApp(null);

      const res = await chai
        .request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'test' } });

      expect(res).to.have.status(401);
      expect(res.body).to.have.property('message', 'not logged in');
    });

    it('should return 400 if rejection reason is missing', async () => {
      app = createApp('testuser');

      const res = await chai.request(app).post('/push/test-push-id-123/reject').send({});

      expect(res).to.have.status(400);
      expect(res.body).to.have.property('message', 'Rejection reason is required');
    });

    it('should return 400 if rejection reason is empty string', async () => {
      app = createApp('testuser');

      const res = await chai
        .request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: '' } });

      expect(res).to.have.status(400);
      expect(res.body).to.have.property('message', 'Rejection reason is required');
    });

    it('should return 400 if rejection reason is only whitespace', async () => {
      app = createApp('testuser');

      const res = await chai
        .request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: '    ' } });

      expect(res).to.have.status(400);
      expect(res.body).to.have.property('message', 'Rejection reason is required');
    });

    it('should return 404 if push does not exist', async () => {
      app = createApp('testuser');
      dbStub.getPush.resolves(null);

      const res = await chai
        .request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res).to.have.status(404);
      expect(res.body).to.have.property('message', 'Push request not found');
    });

    it('should return 400 if push has not userEmail', async () => {
      app = createApp('testuser');
      const pushWithoutEmail = { ...mockPush, userEmail: null };
      dbStub.getPush.resolves(pushWithoutEmail);

      const res = await chai
        .request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res).to.have.status(400);
      expect(res.body).to.have.property('message', 'Push request has no user email');
    });

    it('should return 400 if no registered registered user', async () => {
      app = createApp('testuser');
      dbStub.getPush.resolves(mockPush);
      dbStub.getUsers.onFirstCall().resolves([]);

      const res = await chai
        .request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res).to.have.status(401);
      expect(res.body.message).to.include('no registered user with the committer');
    });

    it('should return 401 if user tries to reject their own push', async () => {
      app = createApp('testcommitter');
      dbStub.getPush.resolves(mockPush);
      dbStub.getUsers.onFirstCall().resolves([
        {
          username: 'testcommitter',
          email: 'committer@example.com',
          admin: false,
        },
      ]);

      const res = await chai
        .request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res).to.have.status(401);
      expect(res.body).to.have.property('message', 'Cannot reject your own changes');
    });

    it('should allow admin to reject their own push', async () => {
      app = createApp('adminuser');
      dbStub.getPush.resolves({ ...mockPush, userEmail: 'admin@example.com' });
      dbStub.getUsers.onFirstCall().resolves([
        {
          username: 'adminuser',
          email: 'admin@example.com',
          admin: true,
        },
      ]);
      dbStub.getUsers.onSecondCall().resolves([
        {
          username: 'adminuser',
          email: 'admin@example.com',
          admin: true,
        },
      ]);
      dbStub.canUserApproveRejectPush.resolves(true);
      dbStub.reject.resolves({ message: 'reject test-push-123' });

      const res = await chai
        .request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Admin rejection' } });

      expect(res).to.have.status(200);
      expect(dbStub.reject.calledOnce).to.be.true;
    });

    it('should return 401 if user is not authorised to reject', async () => {
      app = createApp('unauthorizeduser');
      dbStub.getPush.resolves(mockPush);
      dbStub.getUsers.onFirstCall().resolves([
        {
          username: 'testcommitter',
          email: 'committer@example.com',
          admin: false,
        },
      ]);
      dbStub.canUserApproveRejectPush.resolves(false);

      const res = await chai
        .request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res).to.have.status(401);
      expect(res.body).to.have.property('message', 'User is not authorised to reject changes');
    });

    it('should return 401 if reviewer has no email address', async () => {
      app = createApp('reviewer');
      dbStub.getPush.resolves(mockPush);
      dbStub.getUsers.onFirstCall().resolves([
        {
          username: 'testcommitter',
          email: 'committer@example.com',
          admin: false,
        },
      ]);
      dbStub.getUsers.onSecondCall().resolves([
        {
          username: 'reviewer',
          admin: false,
        },
      ]);
      dbStub.canUserApproveRejectPush.resolves(true);

      const res = await chai
        .request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res).to.have.status(401);
      expect(res.body.message).to.include('no registered email address for the reviewer');
    });

    it('should successfully reject a push with a valid reason', async () => {
      app = createApp('reviewer');
      dbStub.getPush.resolves(mockPush);
      dbStub.getUsers.onFirstCall().resolves([
        {
          username: 'testcommitter',
          email: 'committer@example.com',
          admin: false,
        },
      ]);
      dbStub.canUserApproveRejectPush.resolves(true);
      dbStub.getUsers.onSecondCall().resolves([
        {
          username: 'reviewer',
          email: 'reviewer@example.com',
        },
      ]);
      dbStub.reject.resolves({ message: 'reject test-push-123' });

      const res = await chai
        .request(app)
        .post('/push/test-push-id-123/reject')
        .send({ params: { reason: 'Test reason' } });

      expect(res).to.have.status(200);
      expect(res.body).to.have.property('message');

      // Verify that the reject method was called with correct parameters
      expect(dbStub.reject.calledOnce).to.be.true;
      const [pushId, rejection] = dbStub.reject.firstCall.args;
      expect(pushId).to.equal('test-push-id-123');
      expect(rejection).to.have.property('reason', 'Test reason');
      expect(rejection.reviewer).to.deep.equal({
        username: 'reviewer',
        reviewerEmail: 'reviewer@example.com',
      });
      expect(rejection).to.have.property('timestamp').that.is.a('date');
    });
  });
});
