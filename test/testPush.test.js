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

describe('auth', async () => {
  let app;
  let cookie;

  before(async function () {
    app = await service.start();
    await db.deleteUser('login-test-user');

    const res = await chai.request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin',
    });

    expect(res).to.have.cookie('connect.sid');
    res.should.have.status(200);

    // Get the connect cooie
    res.headers['set-cookie'].forEach((x) => {
      if (x.startsWith('connect')) {
        cookie = x.split(';')[0];
      }
    });
  });

  describe('test push API', async function () {
    it('should get 404 for unknown push', async function () {
      const commitId =
        '0000000000000000000000000000000000000000__79b4d8953cbc324bcc1eb53d6412ff89666c241f'; // eslint-disable-line max-len
      const res = await chai
        .request(app)
        .get(`/api/v1/push/${commitId}`)
        .set('Cookie', `${cookie}`);
      res.should.have.status(404);
    });
  });

  after(async function () {
    const res = await chai.request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
    res.should.have.status(200);

    await service.httpServer.close();
  });
});
