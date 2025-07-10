const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const express = require('express');
const { router, loginSuccessHandler } = require('../../../src/service/routes/auth');
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

  app.use('/auth', router);
  return app;
};

describe('Auth API', function () {
  afterEach(function () {
    sinon.restore();
  });

  describe('loginSuccessHandler', function () {
    it('should log in user and return public user data', async function () {
      const user = {
        username: 'bob',
        password: 'secret',
        email: 'bob@example.com',
        displayName: 'Bob',
      };

      const res = {
        send: sinon.spy(),
      };

      await loginSuccessHandler()({ user }, res);

      expect(res.send.calledOnce).to.be.true;
      expect(res.send.firstCall.args[0]).to.deep.equal({
        message: 'success',
        user: {
          admin: false,
          displayName: 'Bob',
          email: 'bob@example.com',
          gitAccount: '',
          title: '',
          username: 'bob',
        },
      });
    });
  });

  describe('/me', function () {
    it('GET /me returns Unauthorized if authenticated user not in request', async () => {
      const res = await chai.request(newApp()).get('/auth/me');

      expect(res).to.have.status(401);
    });

    it('GET /me serializes public data representation of current authenticated user', async function () {
      sinon.stub(db, 'findUser').resolves({
        username: 'alice',
        password: 'secret-hashed-password',
        email: 'alice@example.com',
        displayName: 'Alice Walker',
        otherUserData: 'should not be returned',
      });

      const res = await chai.request(newApp('alice')).get('/auth/me');
      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({
        username: 'alice',
        displayName: 'Alice Walker',
        email: 'alice@example.com',
        title: '',
        gitAccount: '',
        admin: false,
      });
    });
  });

  describe('/profile', function () {
    it('GET /profile returns Unauthorized if authenticated user not in request', async () => {
      const res = await chai.request(newApp()).get('/auth/profile');

      expect(res).to.have.status(401);
    });

    it('GET /profile serializes public data representation of current authenticated user', async function () {
      sinon.stub(db, 'findUser').resolves({
        username: 'alice',
        password: 'secret-hashed-password',
        email: 'alice@example.com',
        displayName: 'Alice Walker',
        otherUserData: 'should not be returned',
      });

      const res = await chai.request(newApp('alice')).get('/auth/profile');
      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({
        username: 'alice',
        displayName: 'Alice Walker',
        email: 'alice@example.com',
        title: '',
        gitAccount: '',
        admin: false,
      });
    });
  });
});
