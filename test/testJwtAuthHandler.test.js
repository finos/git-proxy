const { expect } = require('chai');
const sinon = require('sinon');
const axios = require('axios');
const { getJwks } = require('../src/service/passport/jwtUtils');

describe('getJwks', () => {
  it('should fetch JWKS keys from authority', async () => {
    const jwksResponse = { keys: [{ kid: 'test-key', kty: 'RSA', n: 'abc', e: 'AQAB' }] };

    const getStub = sinon.stub(axios, 'get');
    getStub.onFirstCall().resolves({ data: { jwks_uri: 'https://mock.com/jwks' } });
    getStub.onSecondCall().resolves({ data: jwksResponse });

    const keys = await getJwks('https://mock.com');
    expect(keys).to.deep.equal(jwksResponse.keys);

    getStub.restore();
  });

  it('should throw error if fetch fails', async () => {
    const stub = sinon.stub(axios, 'get').rejects(new Error('Network fail'));
    try {
      await getJwks('https://fail.com');
    } catch (err) {
      expect(err.message).to.equal('Failed to fetch JWKS');
    }
    stub.restore();
  });
});
