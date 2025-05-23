const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('OIDC auth method', () => {
  let dbStub, passportStub, discoveryStub, fetchUserInfoStub, StrategyStub, strategyCallback;

  const configStub = {
    getAuthMethods: () => ([
      {
        type: 'openidconnect',
        oidcConfig: {
          issuer: 'https://test.com',
          clientID: 'test-client-id',
          clientSecret: 'test-client-secret', 
          callbackURL: 'http://localhost:3000/auth/callback',
          scope: 'openid profile email',
        }
      }
    ])
  };

  const mockUserInfo = {
    sub: 'test-sub',
    email: 'test@test.com',
    name: 'Test User',
  };

  beforeEach(async () => {
    dbStub = {
      findUserByOIDC: sinon.stub(),
      createUser: sinon.stub(),
    };

    passportStub = {
      use: sinon.stub(),
      serializeUser: sinon.stub(),
      deserializeUser: sinon.stub(),
    };

    discoveryStub = sinon.stub().resolves({});
    fetchUserInfoStub = sinon.stub().resolves(mockUserInfo);

    StrategyStub = class {
      constructor(options, callback) {
        strategyCallback = callback;
        this.options = options;
      }

      name = 'oidc';
      authenticate = () => {};
    };

    const { configure } = proxyquire('../src/service/passport/oidc', {
      '../../db': dbStub,
      '../../config': configStub,
      'openid-client': {
        discovery: discoveryStub,
        fetchUserInfo: fetchUserInfoStub,
      },
      'openid-client/passport': {
        Strategy: StrategyStub,
      }
    });

    await configure(passportStub);
  })

  it('should authenticate a new user and create them in the DB', async () => {
    if (!strategyCallback) {
      throw new Error('strategyCallback is not defined');
    }

    dbStub.findUserByOIDC.resolves(null); // same result as new user flow
    dbStub.createUser.resolves({
      username: 'test',
      email: 'test@test.com',
      oidcId: 'test-sub'
    });

    const done = sinon.spy();

    // Workaround for the async callback
    await new Promise((resolve, reject) => {
      strategyCallback({ 
        claims: () => ({ sub: 'test-sub' }), 
        email: 'test@test.com', 
        name: 'Test User' 
      }, (...args) => {
        done(...args);
        resolve();
      });
    });

    expect(done.calledOnce).to.be.true;

    const [err, user] = done.firstCall.args;
    expect(err).to.be.null;
    expect(user).to.have.property('username', 'test');
    expect(user).to.have.property('email', 'test@test.com');
    expect(user).to.have.property('oidcId', 'test-sub');

    expect(dbStub.createUser.calledOnce).to.be.true;
    expect(dbStub.createUser.firstCall.args[0]).to.equal('test');
  });

  it('should return an existing user from the DB', async () => {
    if (!strategyCallback) {
      throw new Error('strategyCallback is not defined');
    }

    const existingUser = {
      username: 'existing',
      email: 'existing@example.com',
      oidcId: 'test-sub'
    };
    dbStub.findUserByOIDC.resolves(existingUser);

    const done = sinon.spy();

    await strategyCallback({ claims: () => ({ sub: 'test-sub' }), access_token: 'access' }, done);

    expect(done.calledOnce).to.be.true;
    const [err, user] = done.firstCall.args;
    expect(err).to.be.null;
    expect(user).to.deep.equal(existingUser);

    expect(dbStub.createUser.notCalled).to.be.true;
  });
});
