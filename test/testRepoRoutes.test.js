// Import the dependencies for testing
const chai = require('chai');
const chaiHttp = require('chai-http');
const db = require('../src/db');
const service = require('../src/service');
const sinon = require('sinon');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

describe('Test Repo routes with admin credentials', async () => {
  let app;
  let cookie;

  const setCookie = function (res) {
    res.headers['set-cookie'].forEach((x) => {
      if (x.startsWith('connect')) {
        const value = x.split(';')[0];
        cookie = value;
      }
    });
  };


  before(async function () {
    app = await service.start();
    // Prepare the data.
    await db.deleteRepo('test-repo');
    await db.deleteUser('u1');
    await db.deleteUser('u2');
    await db.createUser('u1', 'abc', 'test@test.com', 'test', true);
    await db.createUser('u2', 'abc', 'test@test.com', 'test', true);

    const res = await chai.request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin',
    });
    expect(res).to.have.cookie('connect.sid');
    setCookie(res);
  });

  it('should ignore "limit" and "skip" query params for GET /', async () => {
    const getRepoStub = sinon.stub(db, 'getRepos').resolves([]);

    const res = await chai.request(app)
      .get('/api/v1/repo/')
      .query({ limit: 5, skip: 10, admin: false });

    expect(res).to.have.status(200);
    expect(getRepoStub.calledWith({}));
  });


  it('create a new repo', async function () {
    const res = await chai.request(app).post('/api/v1/repo').set('Cookie', `${cookie}`).send({
      project: 'finos',
      name: 'test-repo',
      url: 'https://github.com/finos/test-repo.git',
    });
    res.should.have.status(200);

    const repo = await db.getRepo('test-repo');
    repo.project.should.equal('finos');
    repo.name.should.equal('test-repo');
    repo.url.should.equal('https://github.com/finos/test-repo.git');
    repo.users.canPush.length.should.equal(0);
    repo.users.canAuthorise.length.should.equal(0);
  });

  it('create a new repo without authorisation', async function () {
    const res = await chai.request(app).post('/api/v1/repo')
      .send({
        project: 'finos',
        name: 'test-repo',
        url: 'https://github.com/finos/test-repo.git',
      });
    res.should.have.status(401);
  });

  it('create a duplciate repo', async function () {
    sinon.stub(db, 'getRepo').resolves([{ name: 'test-repo' }]);
    const res = await chai.request(app).post('/api/v1/repo').set('Cookie', `${cookie}`).send({
      project: 'finos',
      name: 'test-repo',
      url: 'https://github.com/finos/test-repo.git',
    });
    res.should.have.status(409);

    sinon.restore();
  });

  describe('test GET API to get repo by name', async function () {
    it('should return status 200 with repo information', async function () {
      const response = await chai
        .request(app)
        .get(`/api/v1/repo/test-repo`);

      response.should.have.status(200);

    })
  });

  it('add 1st can push user', async function () {
    const res = await chai
      .request(app)
      .patch('/api/v1/repo/test-repo/user/push')
      .set('Cookie', `${cookie}`)
      .send({
        username: 'u1',
      });

    res.should.have.status(200);
    const repo = await db.getRepo('test-repo');
    repo.users.canPush.length.should.equal(1);

  });

  it('add 2nd can push user without authorization', async function () {
    const res = await chai
      .request(app)
      .patch('/api/v1/repo/test-repo/user/push')
      .send({
        username: 'u2',
      });

    res.should.have.status(401);
  });

  it('add push user that does not exist', async function () {
    const res = await chai
      .request(app)
      .patch('/api/v1/repo/test-repo/user/push')
      .set('Cookie', `${cookie}`)
      .send({
        username: 'u3',
      });

    res.should.have.status(400);
    const repo = await db.getRepo('test-repo');
    repo.users.canPush.length.should.equal(1);
  });

  it('delete user u1 from push', async function () {
    const res = await chai
      .request(app)
      .delete('/api/v1/repo/test-repo/user/push/u1')
      .set('Cookie', `${cookie}`)
      .send({});

    res.should.have.status(200);
    const repo = await db.getRepo('test-repo');
    repo.users.canPush.length.should.equal(0);
    repo.users.canAuthorise.length.should.equal(0);
  });

  it('delete user u2 from push without authorization', async function () {
    const res = await chai
      .request(app)
      .delete('/api/v1/repo/test-repo/user/push/u2')
      .send({});

    res.should.have.status(401);

  });

  it('delete user that does not exist from push', async function () {
    const res = await chai
      .request(app)
      .delete('/api/v1/repo/test-repo/user/push/u3')
      .set('Cookie', `${cookie}`)
      .send({});

    res.should.have.status(400);

  });

  it('add 1st can authorise user', async function () {
    const res = await chai
      .request(app)
      .patch('/api/v1/repo/test-repo/user/authorise')
      .set('Cookie', `${cookie}`)
      .send({
        username: 'u1',
      });

    res.should.have.status(200);
    const repo = await db.getRepo('test-repo');
    repo.users.canAuthorise.length.should.equal(1);
  });

  it('add 2nd can authorise user without authorization', async function () {
    const res = await chai
      .request(app)
      .patch('/api/v1/repo/test-repo/user/authorise')
      .send({
        username: 'u2',
      });

    res.should.have.status(401);


  });

  it('add authorise user that does not exist', async function () {
    const res = await chai
      .request(app)
      .patch('/api/v1/repo/test-repo/user/authorise')
      .set('Cookie', `${cookie}`)
      .send({
        username: 'u3',
      });

    res.should.have.status(400);
    const repo = await db.getRepo('test-repo');
    repo.users.canAuthorise.length.should.equal(1);
  });

  it('Can delete u1 user', async function () {
    const res = await chai
      .request(app)
      .delete('/api/v1/repo/test-repo/user/authorise/u1')
      .set('Cookie', `${cookie}`)
      .send({});

    res.should.have.status(200);
    const repo = await db.getRepo('test-repo');
    repo.users.canPush.length.should.equal(0);
    repo.users.canAuthorise.length.should.equal(0);
  });

  it('should return 400 for deleting user authorization for user that doesnt exist', async function () {
    const res = await chai
      .request(app)
      .delete('/api/v1/repo/test-repo/user/authorise/u3')
      .set('Cookie', `${cookie}`)
      .send({});

    res.should.have.status(400);
    const repo = await db.getRepo('test-repo');
    repo.users.canAuthorise.length.should.equal(0);
  });

  it('should return 401 for deleting user authorization for user without authorization', async function () {
    const res = await chai
      .request(app)
      .delete('/api/v1/repo/test-repo/user/authorise/u3')
      .send({});

    res.should.have.status(401);
    const repo = await db.getRepo('test-repo');
    repo.users.canAuthorise.length.should.equal(0);
  });

  it('Valid user push permission on repo', async function () {
    const res = await chai
      .request(app)
      .patch('/api/v1/repo/test-repo/user/authorise')
      .set('Cookie', `${cookie}`)
      .send({ username: 'u2' });

    res.should.have.status(200);
    const isAllowed = await db.isUserPushAllowed('test-repo', 'u2');
    expect(isAllowed).to.be.true;
  });

  it('Invalid user push permission on repo', async function () {
    const isAllowed = await db.isUserPushAllowed('test-repo', 'test');
    expect(isAllowed).to.be.false;
  });

  it('Delete repo with authorisation', async function () {
    const res = await chai
      .request(app)
      .delete('/api/v1/repo/test-repo/delete')
      .set('Cookie', `${cookie}`);

    res.should.have.status(200);
  });

  after(async function () {
    await chai.request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
    cookie = null;
    await service.httpServer.close();
  });
});


describe('Test delete repo without admin credentials', async function () {
  let testUserApp;
  let cookie;

  before(async function () {

    const testUserPassword = 'password123';
    const testUser = 'testUser';
    const testEmail = 'test@test.com';
    const testGitAccount = 'testUserAccount';

    await db.deleteUser(testUser);
    await db.createUser(testUser, testUserPassword, testEmail, testGitAccount);

    testUserApp = await service.start();
    const res = await chai.request(testUserApp).post('/api/auth/login').send({
      username: 'testUser',
      password: 'password123',
    });

    expect(res).to.have.cookie('connect.sid');
    res.should.have.status(200);

    res.headers['set-cookie'].forEach((x) => {
      if (x.startsWith('connect')) {
        cookie = x.split(';')[0];
      }
    });



  });
  it('Delete repo with authorisation', async function () {
    const res = await chai
      .request(testUserApp)
      .delete('/api/v1/repo/test-repo/delete')
      .set('Cookie', `${cookie}`);


    res.should.have.status(401);
  });

  after(async function () {
    await chai.request(testUserApp).post('/api/auth/logout').set('Cookie', `${cookie}`);
    cookie = null;
    await service.httpServer.close();

  })
});
