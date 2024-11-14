// Import the dependencies for testing
const chai = require('chai');
const chaiHttp = require('chai-http');
const db = require('../src/db');
const service = require('../src/service');
const sinon = require('sinon');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

describe('User Routes Test', async () => {
  let app;

  const testUser = {
    username: 'testUser',
    password: 'password123',
    email: 'test@test.com',
    gitAccount: 'testGitAccount'
  }

  beforeEach(async function () {
    app = await service.start();
    await db.deleteUser(testUser.username);

    await db.createUser(testUser.username, testUser.password, testUser.email, testUser.gitAccount);
  });

  describe('test user API for retrieving user', async function () {
    it('should fetch users without any query params', async () => {
      sinon.stub(db, 'getUsers').resolves([testUser]);

      const res = await chai.request(app)
        .get('/api/v1/user/');

      expect(res).to.have.status(200);

    });
  });

  describe('test user API for retrieving user with query params', async function () {
    it('should ignore "limit" and "skip" query params', async () => {
      const getUsersStub = sinon.stub(db, 'getUsers').resolves([testUser]);

      const res = await chai.request(app)
        .get('/api/v1/user/')
        .query({ limit: 5, skip: 10, admin: false });

      expect(res).to.have.status(200);
      expect(getUsersStub.calledWith({}));
    });
  });

  describe('test user API for retrieving user with query params', async function () {
    it('should convert "true" and "false" strings to boolean values', async () => {
      sinon.stub(db, 'getUsers').resolves([testUser]);

      const res = await chai.request(app)
        .get('/api/v1/user/')
        .query({ withCredentials: true });

      expect(res).to.have.status(200);

    });
  });

  describe('test user API for retrieving user by ID', async function () {
    it('should return 200 for user existing in the database', async function () {

      sinon.stub(db, 'findUser').resolves(testUser);

      const res = await chai
        .request(app)
        .get(`/api/v1/user/${testUser.username}`);
      res.should.have.status(200);
    });
  });

  afterEach(async function () {
    await service.httpServer.close();
    sinon.restore();
  });
});
