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
  });

  describe('test login / logout', async function () {
    // Test to get all students record
    it('should get 401 not logged in', async function () {
      const res = await chai.request(app).get('/api/auth/profile');

      res.should.have.status(401);
    });

    it('should be able to login', async function () {
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

    it('should now be able to access the user login metadata', async function () {
      const res = await chai.request(app).get('/api/auth/userLoggedIn').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('should now be able to access the profile', async function () {
      const res = await chai.request(app).get('/api/auth/profile').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('should now be able to logout', async function () {
      const res = await chai.request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });

    it('test cannot access profile page', async function () {
      const res = await chai.request(app).get('/api/auth/profile').set('Cookie', `${cookie}`);

      res.should.have.status(401);
    });
  });

  after(async function () {
    await service.httpServer.close();
  });
});
