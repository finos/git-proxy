const chai = require('chai');
const chaiHttp = require('chai-http');
const config = require('../src/config');
const service = require('../src/service');
const sinon = require('sinon');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

describe('Test home routes', async () => {
  let app;

  before(async function () {
    app = await service.start();

  });


  it('should return API endpoints when GET /', async function () {
    const res = await chai.request(app).get('/api');

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      healthcheck: '/api/v1/healthcheck',
      push: '/api/v1/push',
      auth: '/api/auth',
    });
  });

  it('should return OK health check', async function () {
    const res = await chai.request(app).get('/api/v1/healthcheck');

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      message: 'ok',
    });
  });

  it('should call attestation config', async function () {
    const stub = sinon.stub(config, 'getAttestationConfig').resolves();
    const res = await chai.request(app).get('/api/v1/config/attestation');

    expect(res.status).to.equal(200);
    expect(stub.calledOnce).to.be.true;
  });

  it('should call contactEmail config', async function () {
    const stub = sinon.stub(config, 'getContactEmail').resolves();
    const res = await chai.request(app).get('/api/v1/config/contactEmail');

    expect(res.status).to.equal(200);
    expect(stub.calledOnce).to.be.true;
  });

  it('should call urlShortener config', async function () {
    const stub = sinon.stub(config, 'getURLShortener').resolves();
    const res = await chai.request(app).get('/api/v1/config/urlShortener');

    expect(res.status).to.equal(200);
    expect(stub.calledOnce).to.be.true;
  });

  after(async function () {
    await service.httpServer.close();
    sinon.restore();
  });

});
