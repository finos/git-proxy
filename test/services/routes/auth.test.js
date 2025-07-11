const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const express = require('express');
const authRouter = require('../../../src/service/routes/auth');
const db = require('../../../src/db');

const { expect } = chai;
chai.use(chaiHttp);

const newApp = (username) => {
  const app = express();
  app.use(express.json());

  if (username) {
    app.use((req, res, next) => {
      req.user = { username };
      next();
    });
  }

  app.use('/auth', authRouter);
  return app;
};

describe('Authentication Routes', () => {
  describe('/gitAccount', () => {
    beforeEach(() => {
      sinon.stub(db, 'findUser').callsFake((username) => {
        if (username === 'alice') {
          return Promise.resolve({
            username: 'alice',
            displayName: 'Alice Munro',
            gitAccount: 'ORIGINAL_GIT_ACCOUNT',
            email: 'alice@example.com',
            admin: true,
          });
        } else if (username === 'bob') {
          return Promise.resolve({
            username: 'bob',
            displayName: 'Bob Woodward',
            gitAccount: 'WOODY_GIT_ACCOUNT',
            email: 'bob@example.com',
            admin: false,
          });
        }
        return Promise.resolve(null);
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    it('POST /gitAccount returns Unauthorized if authenticated user not in request', async () => {
      const res = await chai.request(newApp()).post('/auth/gitAccount').send({
        username: 'alice',
        gitAccount: '',
      });

      expect(res).to.have.status(401);
    });

    it('POST /gitAccount updates git account for authenticated user', async () => {
      const updateUserStub = sinon.stub(db, 'updateUser').resolves();

      const res = await chai.request(newApp('alice')).post('/auth/gitAccount').send({
        username: 'alice',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res).to.have.status(200);
      expect(
        updateUserStub.calledOnceWith({
          username: 'alice',
          displayName: 'Alice Munro',
          gitAccount: 'UPDATED_GIT_ACCOUNT',
          email: 'alice@example.com',
          admin: true,
        }),
      ).to.be.true;
    });

    it('POST /gitAccount prevents non-admin user changing a different user gitAccount', async () => {
      const updateUserStub = sinon.stub(db, 'updateUser').resolves();

      const res = await chai.request(newApp('bob')).post('/auth/gitAccount').send({
        username: 'phil',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res).to.have.status(403);
      expect(updateUserStub.called).to.be.false;
    });

    it('POST /gitAccount lets admin user change a different users gitAccount', async () => {
      const updateUserStub = sinon.stub(db, 'updateUser').resolves();

      const res = await chai.request(newApp('alice')).post('/auth/gitAccount').send({
        username: 'bob',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res).to.have.status(200);
      expect(
        updateUserStub.calledOnceWith({
          username: 'bob',
          displayName: 'Bob Woodward',
          email: 'bob@example.com',
          admin: false,
          gitAccount: 'UPDATED_GIT_ACCOUNT',
        }),
      ).to.be.true;
    });
    
    it('POST /gitAccount allows non-admin user to update their own gitAccount', async () => {
      const updateUserStub = sinon.stub(db, 'updateUser').resolves();

      const res = await chai.request(newApp('bob')).post('/auth/gitAccount').send({
        username: 'bob',
        gitAccount: 'UPDATED_GIT_ACCOUNT',
      });

      expect(res).to.have.status(200);
      expect(
        updateUserStub.calledOnceWith({
          username: 'bob',
          displayName: 'Bob Woodward',
          email: 'bob@example.com',
          admin: false,
          gitAccount: 'UPDATED_GIT_ACCOUNT',
        }),
      ).to.be.true;
    });

  });
});
