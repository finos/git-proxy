import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import axios from 'axios';
import { utils } from 'ssh2';
import * as crypto from 'crypto';

vi.mock('fs');
vi.mock('axios');

describe('ssh-key CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateFingerprint', () => {
    it('should calculate SHA256 fingerprint for valid ED25519 key', async () => {
      const { calculateFingerprint } = await import('../../src/cli/ssh-key');

      const validKey =
        'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl test@example.com';

      const fingerprint = calculateFingerprint(validKey);

      expect(fingerprint).toBeTruthy();
      expect(fingerprint).toMatch(/^SHA256:/);
    });

    it('should calculate SHA256 fingerprint for key without comment', async () => {
      const { calculateFingerprint } = await import('../../src/cli/ssh-key');

      const validKey =
        'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl';

      const fingerprint = calculateFingerprint(validKey);

      expect(fingerprint).toBeTruthy();
      expect(fingerprint).toMatch(/^SHA256:/);
    });

    it('should return null for invalid key format', async () => {
      const { calculateFingerprint } = await import('../../src/cli/ssh-key');

      const invalidKey = 'not-a-valid-ssh-key';

      const fingerprint = calculateFingerprint(invalidKey);

      expect(fingerprint).toBeNull();
    });

    it('should return null for empty string', async () => {
      const { calculateFingerprint } = await import('../../src/cli/ssh-key');

      const fingerprint = calculateFingerprint('');

      expect(fingerprint).toBeNull();
    });

    it('should handle keys with extra whitespace', async () => {
      const { calculateFingerprint } = await import('../../src/cli/ssh-key');

      const validKey =
        '  ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl test@example.com  ';

      const fingerprint = calculateFingerprint(validKey.trim());

      expect(fingerprint).toBeTruthy();
      expect(fingerprint).toMatch(/^SHA256:/);
    });
  });

  describe('addSSHKey', () => {
    const mockCookieFile = '/home/user/.git-proxy-cookies.json';
    const mockKeyPath = '/home/user/.ssh/id_ed25519.pub';
    const mockPublicKey = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAITest test@example.com';

    beforeEach(() => {
      // Mock environment
      process.env.HOME = '/home/user';
    });

    it('should successfully add SSH key when authenticated', async () => {
      const { addSSHKey } = await import('../../src/cli/ssh-key');

      // Mock file system
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync')
        .mockReturnValueOnce(JSON.stringify({ session: 'cookie-data' })) // Cookie file - must be valid JSON
        .mockReturnValueOnce(mockPublicKey); // SSH key file

      // Mock axios
      const mockPost = vi.fn().mockResolvedValue({ data: { message: 'Success' } });
      vi.mocked(axios.post).mockImplementation(mockPost);

      // Mock console.log
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await addSSHKey('testuser', mockKeyPath);

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readFileSync).toHaveBeenCalledWith(mockKeyPath, 'utf8');
      expect(mockPost).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/user/testuser/ssh-keys',
        { publicKey: mockPublicKey },
        expect.objectContaining({
          withCredentials: true,
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith('SSH key added successfully!');

      consoleLogSpy.mockRestore();
    });

    it('should exit when not authenticated', async () => {
      const { addSSHKey } = await import('../../src/cli/ssh-key');

      // Mock file system - cookie file doesn't exist
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(addSSHKey('testuser', mockKeyPath)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error: Authentication required. Please run "yarn cli login" first.',
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should handle file not found error', async () => {
      const { addSSHKey } = await import('../../src/cli/ssh-key');

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync')
        .mockReturnValueOnce(JSON.stringify({ session: 'cookie-data' })) // Cookie file
        .mockImplementation(() => {
          const error: any = new Error('File not found');
          error.code = 'ENOENT';
          throw error;
        });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(addSSHKey('testuser', mockKeyPath)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Error: Could not find SSH key file at ${mockKeyPath}`,
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should handle API errors with response', async () => {
      const { addSSHKey } = await import('../../src/cli/ssh-key');

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync')
        .mockReturnValueOnce(JSON.stringify({ session: 'cookie-data' }))
        .mockReturnValueOnce(mockPublicKey);

      const apiError: any = new Error('API Error');
      apiError.response = {
        data: { error: 'Key already exists' },
        status: 409,
      };
      vi.mocked(axios.post).mockRejectedValue(apiError);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(addSSHKey('testuser', mockKeyPath)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Response error:', {
        error: 'Key already exists',
      });
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('removeSSHKey', () => {
    const mockKeyPath = '/home/user/.ssh/id_ed25519.pub';
    const mockPublicKey =
      'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl test@example.com';

    beforeEach(() => {
      process.env.HOME = '/home/user';
    });

    it('should successfully remove SSH key when authenticated', async () => {
      const { removeSSHKey } = await import('../../src/cli/ssh-key');

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync')
        .mockReturnValueOnce(JSON.stringify({ session: 'cookie-data' }))
        .mockReturnValueOnce(mockPublicKey);

      const mockDelete = vi.fn().mockResolvedValue({ data: { message: 'Success' } });
      vi.mocked(axios.delete).mockImplementation(mockDelete);

      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await removeSSHKey('testuser', mockKeyPath);

      expect(mockDelete).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('SSH key removed successfully!');

      consoleLogSpy.mockRestore();
    });

    it('should exit when not authenticated', async () => {
      const { removeSSHKey } = await import('../../src/cli/ssh-key');

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(removeSSHKey('testuser', mockKeyPath)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error: Authentication required. Please run "yarn cli login" first.',
      );

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should handle invalid key format', async () => {
      const { removeSSHKey } = await import('../../src/cli/ssh-key');

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync')
        .mockReturnValueOnce(JSON.stringify({ session: 'cookie-data' }))
        .mockReturnValueOnce('invalid-key-format');

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(removeSSHKey('testuser', mockKeyPath)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid SSH key format. Unable to calculate fingerprint.',
      );

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });

    it('should handle API errors', async () => {
      const { removeSSHKey } = await import('../../src/cli/ssh-key');

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync')
        .mockReturnValueOnce(JSON.stringify({ session: 'cookie-data' }))
        .mockReturnValueOnce(mockPublicKey);

      const apiError: any = new Error('Not found');
      apiError.response = {
        data: { error: 'Key not found' },
        status: 404,
      };
      vi.mocked(axios.delete).mockRejectedValue(apiError);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(removeSSHKey('testuser', mockKeyPath)).rejects.toThrow('process.exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', 'Key not found');

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });
});
