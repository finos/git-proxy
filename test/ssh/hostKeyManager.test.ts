import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ensureHostKey, validateHostKeyExists } from '../../src/proxy/ssh/hostKeyManager';

// Mock modules
const { fsStub, childProcessStub } = vi.hoisted(() => {
  return {
    fsStub: {
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      accessSync: vi.fn(),
      constants: { R_OK: 4 },
    },
    childProcessStub: {
      execSync: vi.fn(),
    },
  };
});

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: fsStub.existsSync,
    readFileSync: fsStub.readFileSync,
    mkdirSync: fsStub.mkdirSync,
    accessSync: fsStub.accessSync,
    constants: fsStub.constants,
    default: {
      ...actual,
      existsSync: fsStub.existsSync,
      readFileSync: fsStub.readFileSync,
      mkdirSync: fsStub.mkdirSync,
      accessSync: fsStub.accessSync,
      constants: fsStub.constants,
    },
  };
});

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    execSync: childProcessStub.execSync,
  };
});

describe('hostKeyManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ensureHostKey', () => {
    it('should return existing host key when it exists', () => {
      const privateKeyPath = '/path/to/ssh_host_key';
      const publicKeyPath = '/path/to/ssh_host_key.pub';
      const mockKeyData = Buffer.from(
        '-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----',
      );

      fsStub.existsSync.mockReturnValue(true);
      fsStub.readFileSync.mockReturnValue(mockKeyData);

      const result = ensureHostKey({ privateKeyPath, publicKeyPath });

      expect(result).toEqual(mockKeyData);
      expect(fsStub.existsSync).toHaveBeenCalledWith(privateKeyPath);
      expect(fsStub.readFileSync).toHaveBeenCalledWith(privateKeyPath);
      expect(childProcessStub.execSync).not.toHaveBeenCalled();
    });

    it('should throw error when existing key cannot be read', () => {
      const privateKeyPath = '/path/to/ssh_host_key';
      const publicKeyPath = '/path/to/ssh_host_key.pub';

      fsStub.existsSync.mockReturnValue(true);
      fsStub.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => {
        ensureHostKey({ privateKeyPath, publicKeyPath });
      }).toThrow('Failed to read existing SSH host key');
    });

    it('should throw error for invalid private key path with unsafe characters', () => {
      const privateKeyPath = '/path/to/key;rm -rf /';
      const publicKeyPath = '/path/to/key.pub';

      expect(() => {
        ensureHostKey({ privateKeyPath, publicKeyPath });
      }).toThrow('Invalid SSH host key path');
    });

    it('should throw error for invalid public key path with unsafe characters', () => {
      const privateKeyPath = '/path/to/key';
      const publicKeyPath = '/path/to/key.pub && echo hacked';

      expect(() => {
        ensureHostKey({ privateKeyPath, publicKeyPath });
      }).toThrow('Invalid SSH host key path');
    });

    it('should generate new key when it does not exist', () => {
      const privateKeyPath = '/path/to/ssh_host_key';
      const publicKeyPath = '/path/to/ssh_host_key.pub';
      const mockKeyData = Buffer.from(
        '-----BEGIN OPENSSH PRIVATE KEY-----\ngenerated\n-----END OPENSSH PRIVATE KEY-----',
      );

      fsStub.existsSync
        .mockReturnValueOnce(false) // Check if private key exists
        .mockReturnValueOnce(false) // Check if directory exists
        .mockReturnValueOnce(true); // Verify key was created

      fsStub.readFileSync.mockReturnValue(mockKeyData);
      childProcessStub.execSync.mockReturnValue('');

      const result = ensureHostKey({ privateKeyPath, publicKeyPath });

      expect(result).toEqual(mockKeyData);
      expect(fsStub.mkdirSync).toHaveBeenCalledWith('/path/to', { recursive: true });
      expect(childProcessStub.execSync).toHaveBeenCalledWith(
        `ssh-keygen -t ed25519 -f "${privateKeyPath}" -N "" -C "git-proxy-host-key"`,
        {
          stdio: 'pipe',
          timeout: 10000,
        },
      );
    });

    it('should not create directory if it already exists when generating key', () => {
      const privateKeyPath = '/path/to/ssh_host_key';
      const publicKeyPath = '/path/to/ssh_host_key.pub';
      const mockKeyData = Buffer.from(
        '-----BEGIN OPENSSH PRIVATE KEY-----\ngenerated\n-----END OPENSSH PRIVATE KEY-----',
      );

      fsStub.existsSync
        .mockReturnValueOnce(false) // Check if private key exists
        .mockReturnValueOnce(true) // Directory already exists
        .mockReturnValueOnce(true); // Verify key was created

      fsStub.readFileSync.mockReturnValue(mockKeyData);
      childProcessStub.execSync.mockReturnValue('');

      ensureHostKey({ privateKeyPath, publicKeyPath });

      expect(fsStub.mkdirSync).not.toHaveBeenCalled();
    });

    it('should throw error when key generation fails', () => {
      const privateKeyPath = '/path/to/ssh_host_key';
      const publicKeyPath = '/path/to/ssh_host_key.pub';

      fsStub.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(false);

      childProcessStub.execSync.mockImplementation(() => {
        throw new Error('ssh-keygen not found');
      });

      expect(() => {
        ensureHostKey({ privateKeyPath, publicKeyPath });
      }).toThrow('Failed to generate SSH host key: ssh-keygen not found');
    });

    it('should throw error when generated key file is not found after generation', () => {
      const privateKeyPath = '/path/to/ssh_host_key';
      const publicKeyPath = '/path/to/ssh_host_key.pub';

      fsStub.existsSync
        .mockReturnValueOnce(false) // Check if private key exists
        .mockReturnValueOnce(false) // Check if directory exists
        .mockReturnValueOnce(false); // Verify key was created - FAIL

      childProcessStub.execSync.mockReturnValue('');

      expect(() => {
        ensureHostKey({ privateKeyPath, publicKeyPath });
      }).toThrow('Key generation appeared to succeed but private key file not found');
    });
  });

  describe('validateHostKeyExists', () => {
    it('should return true when key exists and is readable', () => {
      fsStub.accessSync.mockImplementation(() => {
        // No error thrown means success
      });

      const result = validateHostKeyExists('/path/to/key');

      expect(result).toBe(true);
      expect(fsStub.accessSync).toHaveBeenCalledWith('/path/to/key', 4);
    });

    it('should return false when key does not exist', () => {
      fsStub.accessSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = validateHostKeyExists('/path/to/key');

      expect(result).toBe(false);
    });

    it('should return false when key is not readable', () => {
      fsStub.accessSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = validateHostKeyExists('/path/to/key');

      expect(result).toBe(false);
    });
  });
});
