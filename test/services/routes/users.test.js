const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const express = require('express');
const fs = require('fs');
const path = require('path');
const usersRouter = require('../../../src/service/routes/users').default;
const db = require('../../../src/db');
const { DuplicateSSHKeyError, UserNotFoundError } = require('../../../src/errors/DatabaseErrors');

const { expect } = chai;
chai.use(chaiHttp);

describe('Users API', function () {
  let app;

  before(function () {
    app = express();
    app.use(express.json());
    app.use('/users', usersRouter);
  });

  beforeEach(function () {
    sinon.stub(db, 'getUsers').resolves([
      {
        username: 'alice',
        password: 'secret-hashed-password',
        email: 'alice@example.com',
        displayName: 'Alice Walker',
      },
    ]);
    sinon
      .stub(db, 'findUser')
      .resolves({ username: 'bob', password: 'hidden', email: 'bob@example.com' });
  });

  afterEach(function () {
    sinon.restore();
  });

  it('GET /users only serializes public data needed for ui, not user secrets like password', async function () {
    const res = await chai.request(app).get('/users');
    expect(res).to.have.status(200);
    expect(res.body).to.deep.equal([
      {
        username: 'alice',
        displayName: 'Alice Walker',
        email: 'alice@example.com',
        title: '',
        gitAccount: '',
        admin: false,
      },
    ]);
  });

  it('GET /users/:id does not serialize password', async function () {
    const res = await chai.request(app).get('/users/bob');
    expect(res).to.have.status(200);
    console.log(`Response body: ${res.body}`);

    expect(res.body).to.deep.equal({
      username: 'bob',
      displayName: '',
      email: 'bob@example.com',
      title: '',
      gitAccount: '',
      admin: false,
    });
  });

  describe('POST /users/:username/ssh-keys', function () {
    let authenticatedApp;
    const validPublicKey = fs
      .readFileSync(path.join(__dirname, '../../.ssh/host_key.pub'), 'utf8')
      .trim();

    before(function () {
      authenticatedApp = express();
      authenticatedApp.use(express.json());
      authenticatedApp.use((req, res, next) => {
        req.user = { username: 'alice', admin: true };
        next();
      });
      authenticatedApp.use('/users', usersRouter);
    });

    it('should return 409 when SSH key is already used by another user', async function () {
      const publicKey = validPublicKey;

      sinon.stub(db, 'addPublicKey').rejects(new DuplicateSSHKeyError('bob'));

      const res = await chai
        .request(authenticatedApp)
        .post('/users/alice/ssh-keys')
        .send({ publicKey });

      expect(res).to.have.status(409);
      expect(res.body).to.have.property('error');
      expect(res.body.error).to.include("already in use by user 'bob'");
    });

    it('should return 404 when user not found', async function () {
      const publicKey = validPublicKey;

      sinon.stub(db, 'addPublicKey').rejects(new UserNotFoundError('nonexistent'));

      const res = await chai
        .request(authenticatedApp)
        .post('/users/nonexistent/ssh-keys')
        .send({ publicKey });

      expect(res).to.have.status(404);
      expect(res.body).to.have.property('error');
      expect(res.body.error).to.include('User not found');
    });

    it('should return 201 when SSH key is added successfully', async function () {
      const publicKey = validPublicKey;

      sinon.stub(db, 'addPublicKey').resolves();

      const res = await chai
        .request(authenticatedApp)
        .post('/users/alice/ssh-keys')
        .send({ publicKey });

      expect(res).to.have.status(201);
      expect(res.body).to.have.property('message');
      expect(res.body.message).to.equal('SSH key added successfully');
    });

    it('should return 400 when public key is missing', async function () {
      const res = await chai.request(authenticatedApp).post('/users/alice/ssh-keys').send({});

      expect(res).to.have.status(400);
      expect(res.body).to.have.property('error');
      expect(res.body.error).to.include('Public key is required');
    });

    it('should return 500 for unexpected errors', async function () {
      const publicKey = validPublicKey;

      sinon.stub(db, 'addPublicKey').rejects(new Error('Database connection failed'));

      const res = await chai
        .request(authenticatedApp)
        .post('/users/alice/ssh-keys')
        .send({ publicKey });

      expect(res).to.have.status(500);
      expect(res.body).to.have.property('error');
      expect(res.body.error).to.include('Failed to add SSH key');
    });
  });
});
