const chai = require('chai');
const service = require('../src/service');
const config = require('../src/config');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

chai.should();
const expect = chai.expect;

describe('auth methods', async () => {
  let app;

  before(async function () {
    app = await service.start();
  });

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
});
