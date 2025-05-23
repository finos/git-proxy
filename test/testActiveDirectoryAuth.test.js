const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const expect = chai.expect;

describe('ActiveDirectory auth method', () => {
  let ldapStub;
  let dbStub;
  let passportStub;
  let strategyCallback;

  const newConfig = JSON.stringify({
    authentication: [
      {
        type: 'ActiveDirectory',
        enabled: true,
        adminGroup: 'test-admin-group',
        userGroup: 'test-user-group',
        domain: 'test.com',
        adConfig: {
          url: 'ldap://test-url',
          baseDN: 'dc=test,dc=com',
          searchBase: 'ou=users,dc=test,dc=com',
        },
      },
    ],
  });

  beforeEach(() => {
    ldapStub = {
      isUserInAdGroup: sinon.stub(),
    };

    dbStub = {
      updateUser: sinon.stub(),
    };

    passportStub = {
      use: sinon.stub(),
      serializeUser: sinon.stub(),
      deserializeUser: sinon.stub(),
    };

    const fsStub = {
      existsSync: sinon.stub().returns(true),
      readFileSync: sinon.stub().returns(newConfig),
    };

    const config = proxyquire('../src/config', {
      fs: fsStub,
    });

    const { configure } = proxyquire('../src/service/passport/activeDirectory', {
      './ldaphelper': ldapStub,
      '../../db': dbStub,
      '../../config': config,
      'passport-activedirectory': function (options, callback) {
        strategyCallback = callback;
        return {
          name: 'ActiveDirectory',
          authenticate: () => {},
        };
      },
    });

    configure(passportStub);
  });

  it('should authenticate a valid user and mark them as admin', async () => {
    const mockReq = {};
    const mockProfile = {
      _json: {
        sAMAccountName: 'test-user',
        mail: 'test@test.com',
        userPrincipalName: 'test@test.com',
        title: 'Test User',
      },
      displayName: 'Test User',
    };

    ldapStub.isUserInAdGroup
      .onCall(0).resolves(true)
      .onCall(1).resolves(true);

    const done = sinon.spy();

    await strategyCallback(mockReq, mockProfile, {}, done);

    expect(done.calledOnce).to.be.true;
    const [err, user] = done.firstCall.args;
    expect(err).to.be.null;
    expect(user).to.have.property('username', 'test-user');
    expect(user).to.have.property('email', 'test@test.com');
    expect(user).to.have.property('displayName', 'Test User');
    expect(user).to.have.property('admin', true);
    expect(user).to.have.property('title', 'Test User');

    expect(dbStub.updateUser.calledOnce).to.be.true;
  });

  it('should fail if user is not in user group', async () => {
    const mockReq = {};
    const mockProfile = {
      _json: {
        sAMAccountName: 'bad-user',
        mail: 'bad@test.com',
        userPrincipalName: 'bad@test.com',
        title: 'Bad User'
      },
      displayName: 'Bad User'
    };

    ldapStub.isUserInAdGroup.onCall(0).resolves(false);

    const done = sinon.spy();

    await strategyCallback(mockReq, mockProfile, {}, done);

    expect(done.calledOnce).to.be.true;
    const [err, user] = done.firstCall.args;
    expect(err).to.include('not a member');
    expect(user).to.be.null;

    expect(dbStub.updateUser.notCalled).to.be.true;
  });

  it('should handle LDAP errors gracefully', async () => {
    const mockReq = {};
    const mockProfile = {
      _json: {
        sAMAccountName: 'error-user',
        mail: 'err@test.com',
        userPrincipalName: 'err@test.com',
        title: 'Whoops'
      },
      displayName: 'Error User'
    };

    ldapStub.isUserInAdGroup.rejects(new Error('LDAP error'));

    const done = sinon.spy();

    await strategyCallback(mockReq, mockProfile, {}, done);

    expect(done.calledOnce).to.be.true;
    const [err, user] = done.firstCall.args;
    expect(err.message).to.equal('LDAP error');
    expect(user).to.be.null;
  });
});
