const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const express = require('express');
const usersRouter = require('../../../src/service/routes/users').default;
const db = require('../../../src/db');

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
});
