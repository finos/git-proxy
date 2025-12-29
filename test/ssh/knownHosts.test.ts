import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_KNOWN_HOSTS,
  getKnownHosts,
  verifyHostKey,
  KnownHostsConfig,
} from '../../src/proxy/ssh/knownHosts';

describe('knownHosts', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('DEFAULT_KNOWN_HOSTS', () => {
    it('should contain GitHub host key', () => {
      expect(DEFAULT_KNOWN_HOSTS['github.com']).toBeDefined();
      expect(DEFAULT_KNOWN_HOSTS['github.com']).toContain('SHA256:');
    });

    it('should contain GitLab host key', () => {
      expect(DEFAULT_KNOWN_HOSTS['gitlab.com']).toBeDefined();
      expect(DEFAULT_KNOWN_HOSTS['gitlab.com']).toContain('SHA256:');
    });
  });

  describe('getKnownHosts', () => {
    it('should return default hosts when no custom hosts provided', () => {
      const result = getKnownHosts();

      expect(result['github.com']).toBe(DEFAULT_KNOWN_HOSTS['github.com']);
      expect(result['gitlab.com']).toBe(DEFAULT_KNOWN_HOSTS['gitlab.com']);
    });

    it('should merge custom hosts with defaults', () => {
      const customHosts: KnownHostsConfig = {
        'custom.example.com': 'SHA256:customfingerprint',
      };

      const result = getKnownHosts(customHosts);

      expect(result['github.com']).toBe(DEFAULT_KNOWN_HOSTS['github.com']);
      expect(result['gitlab.com']).toBe(DEFAULT_KNOWN_HOSTS['gitlab.com']);
      expect(result['custom.example.com']).toBe('SHA256:customfingerprint');
    });

    it('should allow custom hosts to override defaults', () => {
      const customHosts: KnownHostsConfig = {
        'github.com': 'SHA256:overriddenfingerprint',
      };

      const result = getKnownHosts(customHosts);

      expect(result['github.com']).toBe('SHA256:overriddenfingerprint');
      expect(result['gitlab.com']).toBe(DEFAULT_KNOWN_HOSTS['gitlab.com']);
    });

    it('should handle undefined custom hosts', () => {
      const result = getKnownHosts(undefined);

      expect(result['github.com']).toBe(DEFAULT_KNOWN_HOSTS['github.com']);
    });
  });

  describe('verifyHostKey', () => {
    it('should return true for valid GitHub host key', () => {
      const knownHosts = getKnownHosts();
      const githubKey = DEFAULT_KNOWN_HOSTS['github.com'];

      const result = verifyHostKey('github.com', githubKey, knownHosts);

      expect(result).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return true for valid GitLab host key', () => {
      const knownHosts = getKnownHosts();
      const gitlabKey = DEFAULT_KNOWN_HOSTS['gitlab.com'];

      const result = verifyHostKey('gitlab.com', gitlabKey, knownHosts);

      expect(result).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return false for unknown hostname', () => {
      const knownHosts = getKnownHosts();

      const result = verifyHostKey('unknown.host.com', 'SHA256:anything', knownHosts);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Host key verification failed: Unknown host'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Add the host key to your configuration:'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('"ssh": { "knownHosts": { "unknown.host.com": "SHA256:..." } }'),
      );
    });

    it('should return false for mismatched fingerprint', () => {
      const knownHosts = getKnownHosts();
      const wrongFingerprint = 'SHA256:wrongfingerprint';

      const result = verifyHostKey('github.com', wrongFingerprint, knownHosts);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Host key verification failed for'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Expected: ${DEFAULT_KNOWN_HOSTS['github.com']}`),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Received: ${wrongFingerprint}`),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARNING: This could indicate a man-in-the-middle attack!'),
      );
    });

    it('should verify custom host keys', () => {
      const customHosts: KnownHostsConfig = {
        'custom.example.com': 'SHA256:customfingerprint123',
      };
      const knownHosts = getKnownHosts(customHosts);

      const result = verifyHostKey('custom.example.com', 'SHA256:customfingerprint123', knownHosts);

      expect(result).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should reject custom host with wrong fingerprint', () => {
      const customHosts: KnownHostsConfig = {
        'custom.example.com': 'SHA256:customfingerprint123',
      };
      const knownHosts = getKnownHosts(customHosts);

      const result = verifyHostKey('custom.example.com', 'SHA256:wrongfingerprint', knownHosts);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Host key verification failed for'),
      );
    });

    it('should handle empty known hosts object', () => {
      const emptyHosts: KnownHostsConfig = {};

      const result = verifyHostKey('github.com', 'SHA256:anything', emptyHosts);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Host key verification failed: Unknown host'),
      );
    });
  });
});
