const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const expect = chai.expect;
const { safelyExtractEmail, getUsername } = require('../src/service/passport/oidc');

describe('OIDC auth method', () => {
  let dbStub;
  let passportStub;
  let configure;
  let discoveryStub;
  let fetchUserInfoStub;
  let strategyCtorStub;
  let strategyCallback;

  const newConfig = JSON.stringify({
    authentication: [
      {
        type: 'openidconnect',
        enabled: true,
        oidcConfig: {
          issuer: 'https://fake-issuer.com',
          clientID: 'test-client-id',
          clientSecret: 'test-client-secret',
          callbackURL: 'https://example.com/callback',
          scope: 'openid profile email',
        },
      },
    ],
  });

  beforeEach(() => {
    dbStub = {
      findUserByOIDC: sinon.stub(),
      createUser: sinon.stub(),
    };

    passportStub = {
      use: sinon.stub(),
      serializeUser: sinon.stub(),
      deserializeUser: sinon.stub(),
    };

    discoveryStub = sinon.stub().resolves({ some: 'config' });
    fetchUserInfoStub = sinon.stub();

    // Fake Strategy constructor
    strategyCtorStub = function (options, verifyFn) {
      strategyCallback = verifyFn;
      return {
        name: 'openidconnect',
        currentUrl: sinon.stub().returns({}),
      };
    };

    const fsStub = {
      existsSync: sinon.stub().returns(true),
      readFileSync: sinon.stub().returns(newConfig),
    };

    const config = proxyquire('../src/config', {
      fs: fsStub,
    });
    config.initUserConfig();

    ({ configure } = proxyquire('../src/service/passport/oidc', {
      '../../db': dbStub,
      '../../config': config,
      'openid-client': {
        discovery: discoveryStub,
        fetchUserInfo: fetchUserInfoStub,
      },
      'openid-client/passport': {
        Strategy: strategyCtorStub,
      },
    }));
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should configure passport with OIDC strategy', async () => {
    await configure(passportStub);

    expect(discoveryStub.calledOnce).to.be.true;
    expect(passportStub.use.calledOnce).to.be.true;
    expect(passportStub.serializeUser.calledOnce).to.be.true;
    expect(passportStub.deserializeUser.calledOnce).to.be.true;
  });

  it('should authenticate an existing user', async () => {
    await configure(passportStub);

    const mockTokenSet = {
      claims: () => ({ sub: 'user123' }),
      access_token: 'access-token',
    };
    dbStub.findUserByOIDC.resolves({ id: 'user123', username: 'test-user' });
    fetchUserInfoStub.resolves({ sub: 'user123', email: 'user@test.com' });

    const done = sinon.spy();

    await strategyCallback(mockTokenSet, done);

    expect(done.calledOnce).to.be.true;
    const [err, user] = done.firstCall.args;
    expect(err).to.be.null;
    expect(user).to.have.property('username', 'test-user');
  });

  it('should handle discovery errors', async () => {
    discoveryStub.rejects(new Error('discovery failed'));

    try {
      await configure(passportStub);
      throw new Error('Expected configure to throw');
    } catch (err) {
      expect(err.message).to.include('discovery failed');
    }
  });

  it('should fail if no email in new user profile', async () => {
    await configure(passportStub);

    const mockTokenSet = {
      claims: () => ({ sub: 'sub-no-email' }),
      access_token: 'access-token',
    };
    dbStub.findUserByOIDC.resolves(null);
    fetchUserInfoStub.resolves({ sub: 'sub-no-email' });

    const done = sinon.spy();

    await strategyCallback(mockTokenSet, done);

    const [err, user] = done.firstCall.args;
    expect(err).to.be.instanceOf(Error);
    expect(err.message).to.include('No email found');
    expect(user).to.be.undefined;
  });

  describe('safelyExtractEmail', () => {
    it('should extract email from profile', () => {
      const profile = { email: 'test@test.com' };
      const email = safelyExtractEmail(profile);
      expect(email).to.equal('test@test.com');
    });

    it('should extract email from profile with emails array', () => {
      const profile = { emails: [{ value: 'test@test.com' }] };
      const email = safelyExtractEmail(profile);
      expect(email).to.equal('test@test.com');
    });

    it('should return null if no email in profile', () => {
      const profile = { name: 'test' };
      const email = safelyExtractEmail(profile);
      expect(email).to.be.null;
    });
  });

  describe('getUsername', () => {
    it('should generate username from email', () => {
      const email = 'test@test.com';
      const username = getUsername(email);
      expect(username).to.equal('test');
    });

    it('should return empty string if no email', () => {
      const email = '';
      const username = getUsername(email);
      expect(username).to.equal('');
    });
  });
});
