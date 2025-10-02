/*
  Template test file. Demonstrates how to:
  - Use chai-http to test the server
  - Initialize the server
  - Stub dependencies with sinon sandbox
  - Reset stubs after each test
  - Use proxyquire to replace modules
  - Clear module cache after a test
*/

const chai = require('chai');
const chaiHttp = require('chai-http');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

const service = require('../src/service').default;
const db = require('../src/db');

const expect = chai.expect;

chai.use(chaiHttp);

const TEST_REPO = {
  project: 'finos',
  name: 'db-test-repo',
  url: 'https://github.com/finos/db-test-repo.git',
};

describe('init', () => {
  let app;
  let sandbox;

  // Runs before all tests
  before(async function () {
    // Start the service (can also pass config if testing proxy routes)
    app = await service.start();
  });

  // Runs before each test
  beforeEach(function () {
    // Create a sandbox for stubbing
    sandbox = sinon.createSandbox();

    // Example: stub a DB method
    sandbox.stub(db, 'getRepo').resolves(TEST_REPO);
  });

  // Example test: check server is running
  it('should return 401 if not logged in', async function () {
    const res = await chai.request(app).get('/api/auth/profile');
    expect(res).to.have.status(401);
  });

  // Example test: check db stub is working
  it('should get the repo from stubbed db', async function () {
    const repo = await db.getRepo('finos/db-test-repo');
    expect(repo).to.deep.equal(TEST_REPO);
  });

  // Example test: use proxyquire to override the config module
  it('should return an array of enabled auth methods when overridden', async function () {
    const fsStub = {
      readFileSync: sandbox.stub().returns(
        JSON.stringify({
          authentication: [
            { type: 'local', enabled: true },
            { type: 'ActiveDirectory', enabled: true },
            { type: 'openidconnect', enabled: true },
          ],
        }),
      ),
    };

    const config = proxyquire('../src/config', {
      fs: fsStub,
    });
    config.initUserConfig();
    const authMethods = config.getAuthMethods();
    expect(authMethods).to.have.lengthOf(3);
    expect(authMethods[0].type).to.equal('local');
    expect(authMethods[1].type).to.equal('ActiveDirectory');
    expect(authMethods[2].type).to.equal('openidconnect');

    // Clear config module cache so other tests don't use the stubbed config
    delete require.cache[require.resolve('../src/config')];
  });

  // Runs after each test
  afterEach(function () {
    // Restore all stubs in this sandbox
    sandbox.restore();
  });

  // Runs after all tests
  after(async function () {
    await service.httpServer.close();
  });
});
