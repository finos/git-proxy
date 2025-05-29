const chai = require('chai');
const config = require('../src/config');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

chai.should();
const expect = chai.expect;

describe('auth methods', async () => {
  it('should return a local auth method by default', async function () {
    const authMethods = config.getAuthMethods();
    expect(authMethods).to.have.lengthOf(1);
    expect(authMethods[0].type).to.equal('local');
  });

  it('should return an error if no auth methods are enabled', async function () {
    const newConfig = JSON.stringify({
      authentication: [
        { type: 'local', enabled: false },
        { type: 'ActiveDirectory', enabled: false },
        { type: 'openidconnect', enabled: false },
      ],
    });
  
    const fsStub = {
      existsSync: sinon.stub().returns(true),
      readFileSync: sinon.stub().returns(newConfig),
    };
  
    const config = proxyquire('../src/config', {
      fs: fsStub,
    });
  
    expect(() => config.getAuthMethods()).to.throw(Error, 'No authentication method enabled');
  });

  it('should return an array of enabled auth methods when overridden', async function () {
    const newConfig = JSON.stringify({
      authentication: [
        { type: 'local', enabled: true },
        { type: 'ActiveDirectory', enabled: true },
        { type: 'openidconnect', enabled: true },
      ],
    });

    const fsStub = {
      existsSync: sinon.stub().returns(true),
      readFileSync: sinon.stub().returns(newConfig),
    };

    const config = proxyquire('../src/config', {
      fs: fsStub,
    });

    const authMethods = config.getAuthMethods();
    expect(authMethods).to.have.lengthOf(3);
    expect(authMethods[0].type).to.equal('local');
    expect(authMethods[1].type).to.equal('ActiveDirectory');
    expect(authMethods[2].type).to.equal('openidconnect');
  })
});
