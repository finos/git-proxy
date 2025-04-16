const { expect } = require('chai');
const sinon = require('sinon');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { jwkToBuffer } = require('jwk-to-pem');

const { assignRoles, getJwks, validateJwt } = require('../src/service/passport/jwtUtils');
const jwtAuthHandler = require('../src/service/passport/jwtAuthHandler');

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

describe('assignRoles', () => {
  it('should assign admin role based on claim', () => {
    const user = { username: 'admin-user' };
    const payload = { admin: 'admin' };
    const mapping = { admin: { 'admin': 'admin' } };

    assignRoles(mapping, payload, user);
    expect(user.admin).to.be.true;
  });

  it('should assign multiple roles based on claims', () => {
    const user = { username: 'multi-role-user' };
    const payload = { 'custom-claim-admin': 'custom-value', 'editor': 'editor' };
    const mapping = { admin: { 'custom-claim-admin': 'custom-value' }, editor: { 'editor': 'editor' } };

    assignRoles(mapping, payload, user);
    expect(user.admin).to.be.true;
    expect(user.editor).to.be.true;
  });

  it('should not assign role if claim mismatch', () => {
    const user = { username: 'basic-user' };
    const payload = { admin: 'nope' };
    const mapping = { admin: { admin: 'admin' } };

    assignRoles(mapping, payload, user);
    expect(user.admin).to.be.undefined;
  });

  it('should not assign role if no mapping provided', () => {
    const user = { username: 'no-role-user' };
    const payload = { admin: 'admin' };

    assignRoles(null, payload, user);
    expect(user.admin).to.be.undefined;
  });
});

describe('jwtAuthHandler', () => {
  let req, res, next, jwtConfig, validVerifyResponse;

  beforeEach(() => {
    req = { header: sinon.stub(), isAuthenticated: sinon.stub(), user: {} };
    res = { status: sinon.stub().returnsThis(), send: sinon.stub() };
    next = sinon.stub();

    jwtConfig = {
      clientID: 'client-id',
      authorityURL: 'https://accounts.google.com',
      expectedAudience: 'expected-audience',
      roleMapping: { 'admin': { 'admin': 'admin' } }
    };

    validVerifyResponse = {
      header: { kid: '123' },
      azp: 'client-id',
      sub: 'user123',
      admin: 'admin'
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should call next if user is authenticated', async () => {
    req.isAuthenticated.returns(true);
    await jwtAuthHandler()(req, res, next);
    expect(next.calledOnce).to.be.true;
  });

  it('should return 401 if no token provided', async () => {
    req.header.returns(null);
    await jwtAuthHandler(jwtConfig)(req, res, next);

    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledWith('No token provided\n')).to.be.true;
  });

  it('should return 500 if authorityURL not configured', async () => {
    req.header.returns('Bearer fake-token');
    jwtConfig.authorityURL = null;
    sinon.stub(jwt, 'verify').returns(validVerifyResponse);

    await jwtAuthHandler(jwtConfig)(req, res, next);

    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledWith('OIDC authority URL is not configured\n')).to.be.true;
  });

  it('should return 500 if clientID not configured', async () => {
    req.header.returns('Bearer fake-token');
    jwtConfig.clientID = null;
    sinon.stub(jwt, 'verify').returns(validVerifyResponse);

    await jwtAuthHandler(jwtConfig)(req, res, next);

    expect(res.status.calledWith(500)).to.be.true;
    expect(res.send.calledWith('OIDC client ID is not configured\n')).to.be.true;
  });

  it('should return 401 if JWT validation fails', async () => {
    req.header.returns('Bearer fake-token');
    sinon.stub(jwt, 'verify').throws(new Error('Invalid token'));

    await jwtAuthHandler(jwtConfig)(req, res, next);

    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledWithMatch(/JWT validation failed:/)).to.be.true;
  });
});
