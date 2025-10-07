const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();
const { Action } = require('../../src/proxy/actions/Action');

describe('pullRemote processor', () => {
  let fsStub;
  let simpleGitStub;
  let gitCloneStub;
  let pullRemote;

  const setupModule = () => {
    gitCloneStub = sinon.stub().resolves();
    simpleGitStub = sinon.stub().returns({
      clone: sinon.stub().resolves(),
    });

    pullRemote = proxyquire('../../src/proxy/processors/push-action/pullRemote', {
      fs: fsStub,
      'isomorphic-git': { clone: gitCloneStub },
      'simple-git': { simpleGit: simpleGitStub },
      'isomorphic-git/http/node': {},
    }).exec;
  };

  beforeEach(() => {
    fsStub = {
      existsSync: sinon.stub().returns(true),
      mkdirSync: sinon.stub(),
      promises: {
        mkdtemp: sinon.stub(),
        writeFile: sinon.stub(),
        rm: sinon.stub(),
        rmdir: sinon.stub(),
      },
    };
    setupModule();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('uses service token when cloning SSH repository', async () => {
    const action = new Action(
      '123',
      'push',
      'POST',
      Date.now(),
      'https://github.com/example/repo.git',
    );
    action.protocol = 'ssh';
    action.sshUser = {
      username: 'ssh-user',
      sshKeyInfo: {
        keyType: 'ssh-rsa',
        keyData: Buffer.from('public-key'),
      },
    };

    const req = {
      headers: {},
      authContext: {
        cloneServiceToken: {
          username: 'svc-user',
          password: 'svc-token',
        },
      },
    };

    await pullRemote(req, action);

    expect(gitCloneStub.calledOnce).to.be.true;
    const cloneOptions = gitCloneStub.firstCall.args[0];
    expect(cloneOptions.url).to.equal(action.url);
    expect(cloneOptions.onAuth()).to.deep.equal({
      username: 'svc-user',
      password: 'svc-token',
    });
    expect(action.pullAuthStrategy).to.equal('ssh-service-token');
  });

  it('throws descriptive error when HTTPS authorization header is missing', async () => {
    const action = new Action(
      '456',
      'push',
      'POST',
      Date.now(),
      'https://github.com/example/repo.git',
    );
    action.protocol = 'https';

    const req = {
      headers: {},
    };

    try {
      await pullRemote(req, action);
      expect.fail('Expected pullRemote to throw');
    } catch (error) {
      expect(error.message).to.equal('Missing Authorization header for HTTPS clone');
    }
  });
});
