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
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdtemp: fsStub.promises.mkdtemp,
      writeFile: fsStub.promises.writeFile,
      rm: fsStub.promises.rm,
      rmdir: fsStub.promises.rmdir,
      mkdir: fsStub.promises.mkdir,
    },
    default: actual,
  };
});

vi.mock('child_process', () => ({
  execSync: childProcessStub.execSync,
  spawn: childProcessStub.spawn,
}));

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
});
