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
