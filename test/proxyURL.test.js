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
const chai = require('chai');
const sinon = require('sinon');
const express = require('express');
const chaiHttp = require('chai-http');
const { getProxyURL } = require('../src/service/urls');
const config = require('../src/config');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

const genSimpleServer = () => {
  const app = express();
  app.get('/', (req, res) => {
    res.contentType('text/html');
    res.send(getProxyURL(req));
  });
  return app;
};

describe('proxyURL', async () => {
  afterEach(() => {
    sinon.restore();
  });

  it('pulls the request path with no override', async () => {
    const app = genSimpleServer();
    const res = await chai.request(app).get('/').send();
    res.should.have.status(200);

    // request url without trailing slash
    const reqURL = res.request.url.slice(0, -1);
    expect(res.text).to.equal(reqURL);
    expect(res.text).to.match(/https?:\/\/127.0.0.1:\d+/);
  });

  it('can override providing a proxy value', async () => {
    const proxyURL = 'https://amazing-proxy.path.local';
    // stub getDomains
    const configGetDomainsStub = sinon.stub(config, 'getDomains').returns({ proxy: proxyURL });

    const app = genSimpleServer();
    const res = await chai.request(app).get('/').send();
    res.should.have.status(200);

    // the stub worked
    expect(configGetDomainsStub.calledOnce).to.be.true;

    expect(res.text).to.equal(proxyURL);
  });
});
