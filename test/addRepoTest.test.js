/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.    
 */

// Import the dependencies for testing
const chai = require('chai');
const chaiHttp = require('chai-http');
const db = require('../src/db');
const service = require('../src/service');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

describe('add new repo', async () => {
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
  });

  it('login', async function () {
    const res = await chai.request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin',
    });
    expect(res).to.have.cookie('connect.sid');
    setCookie(res);
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
    repo.users.canPush[0].should.equal('u1');
  });

  it('add 2nd can push user', async function () {
    const res = await chai
      .request(app)
      .patch('/api/v1/repo/test-repo/user/push')
      .set('Cookie', `${cookie}`)
      .send({
        username: 'u2',
      });

    res.should.have.status(200);
    const repo = await db.getRepo('test-repo');
    repo.users.canPush.length.should.equal(2);
    repo.users.canPush[1].should.equal('u2');
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
    repo.users.canPush.length.should.equal(2);
  });

  it('delete user u2 from push', async function () {
    const res = await chai
      .request(app)
      .delete('/api/v1/repo/test-repo/user/push/u2')
      .set('Cookie', `${cookie}`)
      .send({});

    res.should.have.status(200);
    const repo = await db.getRepo('test-repo');
    repo.users.canPush.length.should.equal(1);
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
    repo.users.canAuthorise[0].should.equal('u1');
  });

  it('add 2nd can authorise user', async function () {
    const res = await chai
      .request(app)
      .patch('/api/v1/repo/test-repo/user/authorise')
      .set('Cookie', `${cookie}`)
      .send({
        username: 'u2',
      });

    res.should.have.status(200);
    const repo = await db.getRepo('test-repo');
    repo.users.canAuthorise.length.should.equal(2);
    repo.users.canAuthorise[1].should.equal('u2');
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
    repo.users.canAuthorise.length.should.equal(2);
  });

  it('Can delete u2 user', async function () {
    const res = await chai
      .request(app)
      .delete('/api/v1/repo/test-repo/user/authorise/u2')
      .set('Cookie', `${cookie}`)
      .send({});

    res.should.have.status(200);
    const repo = await db.getRepo('test-repo');
    repo.users.canAuthorise.length.should.equal(1);
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

  after(async function () {
    await service.httpServer.close();
  });
});
