/* eslint-disable max-len */

const chai = require('chai');
const actions = require('../src/proxy/actions/Action');
const processor = require('../src/proxy/processors/push-action/checkUserPushPermission.js');
const chaiHttp = require('chai-http');
const db = require('../src/db');
const service = require('../src/service');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

describe('Check user has push permission', async () => {
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
    // Prepare the data.
    await db.deleteRepo('test-repo');
    await db.deleteUser('u1');
    await db.deleteUser('u2');
    await db.createUser('u1', 'abc', '', 'test', true, true, true, false);
    await db.createUser('u2', 'abc', '', 'test', true, true, true, false);
  });

  it('login', async function() {
    const res = await chai.request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin',
        });
    expect(res).to.have.cookie('connect.sid');
    setCookie(res);
  });

  it('create a new repo', async function() {
    const res = await chai.request(app)
        .post('/api/v1/repo')
        .set('Cookie', `${cookie}`)
        .send({
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

  it('add 1st can push user', async function() {
    const res = await chai.request(app)
        .patch('/api/v1/repo/test-repo/user/push')
        .set('Cookie', `${cookie}`)
        .send({
          username: 'u1',
        });

    res.should.have.status(200);
    const repo = await db.getRepo('test-repo');
    repo.users.canPush.length.should.equal(1);
    repo.users.canPush[0].should.equal('u1');
  });

  it('Should set ok=true if user has push permission', () => this.timeout(15000), async () => {
    const action = new actions.Action('123', 'type', 'get', 1234, 'thisproject/test-repo.git');
    action.user='u1';
    const result = await processor.exec(null, action);
    expect(result.error).to.be.false;
  });

  it('Should set ok=false if user has push permission', () => this.timeout(15000), async () => {
    const action = new actions.Action('123', 'type', 'get', 1234, 'thisproject/repo-is-not-ok');
    action.user='u10';
    const result = await processor.exec(null, action);
    expect(result.error).to.be.true;
  });

  after(async function() {
    await service.httpServer.close();
  });
});
