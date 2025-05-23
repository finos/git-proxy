const chai = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const expect = chai.expect;

describe('ActiveDirectory auth method', () => {
  let ldapStub, dbStub, passportStub, strategyCallback;

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

});
