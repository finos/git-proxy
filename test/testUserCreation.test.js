// Import the dependencies for testing
const chai = require('chai');
const chaiHttp = require('chai-http');
const passwordHash = require('password-hash');
const db = require('../src/db');
const service = require('../src/service');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;
const should = chai.should();

describe('user creation', async () => {
  let app;
  let cookie;

  const setCookie = function(res) {
    res.headers['set-cookie'].forEach((x) => {
      if (x.startsWith('connect')) {
        const value = x.split(';')[0];
        cookie = value;
      }
    });
  };

  before(async function() {
    app = await service.start();
    await db.deleteUser('login-test-user');
  });

  it('should be able to login', async function() {
    const res = await chai.request(app)
        .post('/auth/login')
        .send({
          username: 'admin',
          password: 'admin',
        });

    expect(res).to.have.cookie('connect.sid');
    res.should.have.status(200);
    setCookie(res);
  });

  it('should be able to create a new user', async function() {
    const res = await chai.request(app)
        .post('/auth/profile')
        .set('Cookie', `${cookie}`)
        .send({
          username: 'login-test-user',
          email: 'paul.timothy.groves@gmail.com',
          gitAccount: 'test123',
          admin: true,
        });
    res.should.have.status(200);
  });

  it('new users should be marked to change next login', async function() {
    const user = await db.findUser('login-test-user');
    user.changePassword.should.be.true;
  });

  it('logout', async function() {
    const res = await chai.request(app)
        .post('/auth/logout')
        .set('Cookie', `${cookie}`);
    res.should.have.status(200);
  });

  it('login as new user', async function() {
    // we don't know the users tempoary password - so force update a
    // pasword
    const user = await db.findUser('login-test-user');
    user.password = passwordHash.generate('test1234');
    await db.updateUser(user);

    const res = await chai.request(app)
        .post('/auth/login')
        .send({
          username: 'login-test-user',
          password: 'test1234',
        });

    expect(res).to.have.cookie('connect.sid');
    res.should.have.status(200);
    setCookie(res);
  });

  it('change the password', async function() {
    const res = await chai.request(app)
        .post('/auth/password')
        .set('Cookie', `${cookie}`)
        .send({
          oldPassword: 'test1234',
          newPassword: 'testabcd',
        });

    res.should.have.status(200);
  });

  it('updated users should NOT need to change next login', async function() {
    const user = await db.findUser('login-test-user');
    user.changePassword.should.be.false;
  });

  it('logout - again', function(done) {
    chai.request(app)
        .post('/auth/logout')
        .end((err, res) => {
          res.should.have.status(200);
          done();
        });
  });

  it('login again', async function() {
    const res = await chai.request(app)
        .post('/auth/login')
        .send({
          username: 'login-test-user',
          password: 'testabcd',
        });

    expect(res).to.have.cookie('connect.sid');
    res.should.have.status(200);
    setCookie(res);
  });

  it('should access the profile', async function() {
    const res = await chai.request(app)
        .get('/auth/profile')
        .set('Cookie', `${cookie}`);
    res.should.have.status(200);

    res.body.username.should.equal('login-test-user');
    should.not.exist(res.body.password);
  });

  after(async function() {
    await service.httpServer.close();
  });
});
