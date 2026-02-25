import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { Action } from '../../src/proxy/actions/Action';

// Mock stubs that will be configured in beforeEach - use vi.hoisted to ensure they're available in mock factories
const { fsStub, gitCloneStub, simpleGitCloneStub, simpleGitStub, childProcessStub } = vi.hoisted(
  () => {
    return {
      fsStub: {
        promises: {
          mkdtemp: vi.fn(),
          writeFile: vi.fn(),
          rm: vi.fn(),
          rmdir: vi.fn(),
          mkdir: vi.fn(),
        },
      },
      gitCloneStub: vi.fn(),
      simpleGitCloneStub: vi.fn(),
      simpleGitStub: vi.fn(),
      childProcessStub: {
        execSync: vi.fn(),
        spawn: vi.fn(),
      },
    };
  },
);

// Mock modules at top level with factory functions
// Use spy instead of full mock to preserve real fs for other tests
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  const mockFs = {
    ...actual,
    promises: {
      ...actual.promises,
      mkdtemp: fsStub.promises.mkdtemp,
      writeFile: fsStub.promises.writeFile,
      rm: fsStub.promises.rm,
      rmdir: fsStub.promises.rmdir,
      mkdir: fsStub.promises.mkdir,
    },
  };
  return {
    ...mockFs,
    default: mockFs,
  };
});

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    execSync: childProcessStub.execSync,
    spawn: childProcessStub.spawn,
  };
});

vi.mock('isomorphic-git', () => ({
  clone: gitCloneStub,
}));

vi.mock('simple-git', () => ({
  simpleGit: simpleGitStub,
}));

vi.mock('isomorphic-git/http/node', () => ({}));

// Import after mocking
import { exec as pullRemote } from '../../src/proxy/processors/push-action/pullRemote';

describe('pullRemote processor', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Configure fs mock
    fsStub.promises.mkdtemp.mockResolvedValue('/tmp/test-clone-dir');
    fsStub.promises.writeFile.mockResolvedValue(undefined);
    fsStub.promises.rm.mockResolvedValue(undefined);
    fsStub.promises.rmdir.mockResolvedValue(undefined);
    fsStub.promises.mkdir.mockResolvedValue(undefined);

    // Configure child_process mock
    // Mock execSync to return ssh-keyscan output with GitHub's fingerprint
    childProcessStub.execSync.mockReturnValue(
      'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl\n',
    );

    // Mock spawn to return a fake process that emits 'close' with code 0
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, callback: any) => {
        if (event === 'close') {
          // Call callback asynchronously to simulate process completion
          setImmediate(() => callback(0));
        }
        return mockProcess;
      }),
    };
    childProcessStub.spawn.mockReturnValue(mockProcess);

    // Configure git mock
    gitCloneStub.mockResolvedValue(undefined);

    // Configure simple-git mock
    simpleGitCloneStub.mockResolvedValue(undefined);
    simpleGitStub.mockReturnValue({
      clone: simpleGitCloneStub,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('throws error when SSH protocol requested without agent forwarding', async () => {
    const action = new Action(
      '999',
      'push',
      'POST',
      Date.now(),
      'https://github.com/example/repo.git',
    );
    action.protocol = 'ssh';

    const req = {
      sshClient: {
        agentForwardingEnabled: false, // Agent forwarding disabled
      },
    };

    try {
      await pullRemote(req, action);
      expect.fail('Expected pullRemote to throw');
    } catch (error: any) {
      expect(error.message).toContain('SSH clone requires agent forwarding to be enabled');
      expect(error.message).toContain('ssh -A');
    }
  });

  it('throws error when SSH protocol requested without sshClient', async () => {
    const action = new Action(
      '998',
      'push',
      'POST',
      Date.now(),
      'https://github.com/example/repo.git',
    );
    action.protocol = 'ssh';

    const req = {
      // No sshClient
    };

    try {
      await pullRemote(req, action);
      expect.fail('Expected pullRemote to throw');
    } catch (error: any) {
      expect(error.message).toContain('SSH clone requires agent forwarding to be enabled');
    }
  });

  it('uses SSH agent forwarding when cloning SSH repository', async () => {
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
      sshClient: {
        agentForwardingEnabled: true,
        _agent: {
          _sock: {
            path: '/tmp/ssh-agent.sock',
          },
        },
      },
    };

    await pullRemote(req, action);

    // For SSH protocol, should use spawn (system git), not isomorphic-git
    expect(childProcessStub.spawn).toHaveBeenCalled();
    const spawnCall = childProcessStub.spawn.mock.calls[0];
    expect(spawnCall[0]).toBe('git');
    expect(spawnCall[1]).toContain('clone');
    expect(action.pullAuthStrategy).toBe('ssh-agent-forwarding');
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

  it('throws error when HTTPS authorization header has invalid format', async () => {
    const action = new Action(
      '457',
      'push',
      'POST',
      Date.now(),
      'https://github.com/example/repo.git',
    );
    action.protocol = 'https';

    const req = {
      headers: {
        authorization: 'Bearer invalid-token', // Not Basic auth
      },
    };

    try {
      await pullRemote(req, action);
      expect.fail('Expected pullRemote to throw');
    } catch (error: any) {
      expect(error.message).toBe('Invalid Authorization header format');
    }
  });

  it('throws error when HTTPS authorization credentials missing colon separator', async () => {
    const action = new Action(
      '458',
      'push',
      'POST',
      Date.now(),
      'https://github.com/example/repo.git',
    );
    action.protocol = 'https';

    // Create invalid base64 encoded credentials (without ':' separator)
    const invalidCredentials = Buffer.from('usernamepassword').toString('base64');
    const req = {
      headers: {
        authorization: `Basic ${invalidCredentials}`,
      },
    };

    try {
      await pullRemote(req, action);
      expect.fail('Expected pullRemote to throw');
    } catch (error: any) {
      expect(error.message).toBe('Invalid Authorization header credentials');
    }
  });

  it('should create SSH config file with correct settings', async () => {
    const action = new Action(
      '789',
      'push',
      'POST',
      Date.now(),
      'https://github.com/example/repo.git',
    );
    action.protocol = 'ssh';
    action.repoName = 'repo';
    action.sshUser = {
      username: 'test-user',
      sshKeyInfo: {
        keyType: 'ssh-ed25519',
        keyData: Buffer.from('test-key'),
      },
    };

    const req = {
      sshClient: {
        agentForwardingEnabled: true,
        _agent: {
          _sock: {
            path: '/tmp/ssh-agent-test.sock',
          },
        },
      },
    };

    await pullRemote(req, action);

    // Verify SSH config file was written
    expect(fsStub.promises.writeFile).toHaveBeenCalled();
    const writeFileCall = fsStub.promises.writeFile.mock.calls.find((call: any) =>
      call[0].includes('ssh_config'),
    );
    expect(writeFileCall).toBeDefined();
    if (!writeFileCall) throw new Error('SSH config file not written');

    const sshConfig = writeFileCall[1];
    expect(sshConfig).toContain('StrictHostKeyChecking yes');
    expect(sshConfig).toContain('IdentityAgent /tmp/ssh-agent-test.sock');
    expect(sshConfig).toContain('PasswordAuthentication no');
    expect(sshConfig).toContain('PubkeyAuthentication yes');
  });

  it('should pass correct arguments to git clone', async () => {
    const action = new Action(
      '101',
      'push',
      'POST',
      Date.now(),
      'https://github.com/org/myrepo.git',
    );
    action.protocol = 'ssh';
    action.repoName = 'myrepo';
    action.sshUser = {
      username: 'test-user',
      sshKeyInfo: {
        keyType: 'ssh-ed25519',
        keyData: Buffer.from('test-key'),
      },
    };

    const req = {
      sshClient: {
        agentForwardingEnabled: true,
        _agent: {
          _sock: {
            path: '/tmp/agent.sock',
          },
        },
      },
    };

    await pullRemote(req, action);

    // Verify spawn was called with correct git arguments
    expect(childProcessStub.spawn).toHaveBeenCalledWith(
      'git',
      expect.arrayContaining(['clone', '--depth', '1', '--single-branch']),
      expect.objectContaining({
        cwd: `./.remote/${action.id}`,
        env: expect.objectContaining({
          GIT_SSH_COMMAND: expect.stringContaining('ssh -F'),
        }),
      }),
    );
  });

  it('should throw error when git clone fails with non-zero exit code', async () => {
    const action = new Action(
      '202',
      'push',
      'POST',
      Date.now(),
      'https://github.com/example/repo.git',
    );
    action.protocol = 'ssh';
    action.repoName = 'repo';
    action.sshUser = {
      username: 'test-user',
      sshKeyInfo: {
        keyType: 'ssh-ed25519',
        keyData: Buffer.from('test-key'),
      },
    };

    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: {
        on: vi.fn((event: string, callback: any) => {
          if (event === 'data') {
            callback(Buffer.from('Permission denied (publickey)'));
          }
        }),
      },
      on: vi.fn((event: string, callback: any) => {
        if (event === 'close') {
          setImmediate(() => callback(1)); // Exit code 1 = failure
        }
        return mockProcess;
      }),
    };
    childProcessStub.spawn.mockReturnValue(mockProcess);

    const req = {
      sshClient: {
        agentForwardingEnabled: true,
        _agent: {
          _sock: {
            path: '/tmp/agent.sock',
          },
        },
      },
    };

    await expect(pullRemote(req, action)).rejects.toThrow('SSH clone failed');
  });

  it('should throw error when git spawn fails', async () => {
    const action = new Action(
      '303',
      'push',
      'POST',
      Date.now(),
      'https://github.com/example/repo.git',
    );
    action.protocol = 'ssh';
    action.repoName = 'repo';
    action.sshUser = {
      username: 'test-user',
      sshKeyInfo: {
        keyType: 'ssh-ed25519',
        keyData: Buffer.from('test-key'),
      },
    };

    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, callback: any) => {
        if (event === 'error') {
          setImmediate(() => callback(new Error('ENOENT: git command not found')));
        }
        return mockProcess;
      }),
    };
    childProcessStub.spawn.mockReturnValue(mockProcess);

    const req = {
      sshClient: {
        agentForwardingEnabled: true,
        _agent: {
          _sock: {
            path: '/tmp/agent.sock',
          },
        },
      },
    };

    await expect(pullRemote(req, action)).rejects.toThrow('SSH clone failed');
  });

  it('should cleanup temp directory even when clone fails', async () => {
    const action = new Action(
      '404',
      'push',
      'POST',
      Date.now(),
      'https://github.com/example/repo.git',
    );
    action.protocol = 'ssh';
    action.repoName = 'repo';
    action.sshUser = {
      username: 'test-user',
      sshKeyInfo: {
        keyType: 'ssh-ed25519',
        keyData: Buffer.from('test-key'),
      },
    };

    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, callback: any) => {
        if (event === 'close') {
          setImmediate(() => callback(1)); // Failure
        }
        return mockProcess;
      }),
    };
    childProcessStub.spawn.mockReturnValue(mockProcess);

    const req = {
      sshClient: {
        agentForwardingEnabled: true,
        _agent: {
          _sock: {
            path: '/tmp/agent.sock',
          },
        },
      },
    };

    await expect(pullRemote(req, action)).rejects.toThrow();

    // Verify cleanup was called
    expect(fsStub.promises.rm).toHaveBeenCalledWith(
      expect.stringContaining('/tmp/test-clone-dir'),
      { recursive: true, force: true },
    );
  });

  it('should use SSH_AUTH_SOCK environment variable if agent socket not in client', async () => {
    process.env.SSH_AUTH_SOCK = '/var/run/ssh-agent.sock';

    const action = new Action(
      '505',
      'push',
      'POST',
      Date.now(),
      'https://github.com/example/repo.git',
    );
    action.protocol = 'ssh';
    action.repoName = 'repo';
    action.sshUser = {
      username: 'test-user',
      sshKeyInfo: {
        keyType: 'ssh-ed25519',
        keyData: Buffer.from('test-key'),
      },
    };

    const req = {
      sshClient: {
        agentForwardingEnabled: true,
        _agent: {}, // No _sock property
      },
    };

    await pullRemote(req, action);

    // Verify SSH config uses env variable
    const writeFileCall = fsStub.promises.writeFile.mock.calls.find((call: any) =>
      call[0].includes('ssh_config'),
    );
    expect(writeFileCall).toBeDefined();
    if (!writeFileCall) throw new Error('SSH config file not written');
    expect(writeFileCall[1]).toContain('IdentityAgent /var/run/ssh-agent.sock');

    delete process.env.SSH_AUTH_SOCK;
  });

  it('should verify known_hosts file is created with correct permissions', async () => {
    const action = new Action(
      '606',
      'push',
      'POST',
      Date.now(),
      'https://github.com/example/repo.git',
    );
    action.protocol = 'ssh';
    action.repoName = 'repo';
    action.sshUser = {
      username: 'test-user',
      sshKeyInfo: {
        keyType: 'ssh-ed25519',
        keyData: Buffer.from('test-key'),
      },
    };

    const req = {
      sshClient: {
        agentForwardingEnabled: true,
        _agent: {
          _sock: {
            path: '/tmp/agent.sock',
          },
        },
      },
    };

    await pullRemote(req, action);

    // Verify known_hosts file was created with mode 0o600
    const knownHostsCall = fsStub.promises.writeFile.mock.calls.find((call: any) =>
      call[0].includes('known_hosts'),
    );
    expect(knownHostsCall).toBeDefined();
    if (!knownHostsCall) throw new Error('known_hosts file not written');
    expect(knownHostsCall[2]).toEqual({ mode: 0o600 });
  });
});
