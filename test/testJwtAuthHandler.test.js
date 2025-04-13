const { expect } = require('chai');
const sinon = require('sinon');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { jwkToBuffer } = require('jwk-to-pem');

const { getJwks, validateJwt } = require('../src/service/passport/jwtUtils');
const { jwtAuthHandler } = require('../src/service/passport/jwtAuthHandler');

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

describe('validateJwt', () => {
  let decodeStub, verifyStub, pemStub, getJwksStub;

  beforeEach(() => {
    const jwksResponse = { keys: [{ kid: 'test-key', kty: 'RSA', n: 'abc', e: 'AQAB' }] };
    const getStub = sinon.stub(axios, 'get');
    getStub.onFirstCall().resolves({ data: { jwks_uri: 'https://mock.com/jwks' } });
    getStub.onSecondCall().resolves({ data: jwksResponse });

    getJwksStub = sinon.stub().resolves(jwksResponse.keys);
    decodeStub = sinon.stub(jwt, 'decode');
    verifyStub = sinon.stub(jwt, 'verify');
    pemStub = sinon.stub(jwkToBuffer);

    pemStub.returns('fake-public-key');
    getJwksStub.returns(jwksResponse.keys);
  });

  afterEach(() => sinon.restore());

  it('should validate a correct JWT', async () => {
    const mockJwk = { kid: '123', kty: 'RSA', n: 'abc', e: 'AQAB' };
    const mockPem = 'fake-public-key';

    decodeStub.returns({ header: { kid: '123' } });
    getJwksStub.resolves([mockJwk]);
    pemStub.returns(mockPem);
    verifyStub.returns({ azp: 'client-id', sub: 'user123' });

    const { verifiedPayload } = await validateJwt('fake.token.here', 'https://issuer.com', 'client-id', 'client-id', getJwksStub);
    expect(verifiedPayload.sub).to.equal('user123');
  });

  it('should return error if JWT invalid', async () => {
    decodeStub.returns(null); // Simulate broken token

    const { error } = await validateJwt('bad.token', 'https://issuer.com', 'client-id', 'client-id', getJwksStub);
    expect(error).to.include('Invalid JWT');
  });
});

