import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { Action } from '../../src/proxy/actions/Action';

// Mock modules
vi.mock('fs');
vi.mock('isomorphic-git');
vi.mock('simple-git');
vi.mock('isomorphic-git/http/node', () => ({}));

describe('pullRemote processor', () => {
  let fsStub: any;
  let gitCloneStub: any;
  let simpleGitStub: any;
  let pullRemote: any;

  const setupModule = async () => {
    gitCloneStub = vi.fn().mockResolvedValue(undefined);
    simpleGitStub = vi.fn().mockReturnValue({
      clone: vi.fn().mockResolvedValue(undefined),
    });

    // Mock the dependencies
    vi.doMock('fs', () => ({
      promises: fsStub.promises,
    }));
    vi.doMock('isomorphic-git', () => ({
      clone: gitCloneStub,
    }));
    vi.doMock('simple-git', () => ({
      simpleGit: simpleGitStub,
    }));

    // Import after mocking
    const module = await import('../../src/proxy/processors/push-action/pullRemote');
    pullRemote = module.exec;
  };

  beforeEach(async () => {
    fsStub = {
      promises: {
        mkdtemp: vi.fn(),
        writeFile: vi.fn(),
        rm: vi.fn(),
        rmdir: vi.fn(),
        mkdir: vi.fn(),
      },
    };
    await setupModule();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

    expect(gitCloneStub).toHaveBeenCalledOnce();
    const cloneOptions = gitCloneStub.mock.calls[0][0];
    expect(cloneOptions.url).toBe(action.url);
    expect(cloneOptions.onAuth()).toEqual({
      username: 'svc-user',
      password: 'svc-token',
    });
    expect(action.pullAuthStrategy).toBe('ssh-service-token');
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
    } catch (error: any) {
      expect(error.message).toBe('Missing Authorization header for HTTPS clone');
    }
  });
});
