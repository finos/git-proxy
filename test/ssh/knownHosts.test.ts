/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getKnownHosts, verifyHostKey, KnownHostsConfig } from '../../src/proxy/ssh/knownHosts';

const GITHUB_FINGERPRINT = 'SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU';
const GITLAB_FINGERPRINT = 'SHA256:eUXGGm1YGsMAS7vkcx6JOJdOGHPem5gQp4taiCfCLB8';

describe('knownHosts', () => {
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('getKnownHosts', () => {
    it('should return empty object when no hosts provided', () => {
      const result = getKnownHosts();

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should return configured hosts', () => {
      const hosts: KnownHostsConfig = {
        'github.com': GITHUB_FINGERPRINT,
        'gitlab.com': GITLAB_FINGERPRINT,
      };

      const result = getKnownHosts(hosts);

      expect(result['github.com']).toBe(GITHUB_FINGERPRINT);
      expect(result['gitlab.com']).toBe(GITLAB_FINGERPRINT);
    });

    it('should include custom hosts', () => {
      const hosts: KnownHostsConfig = {
        'github.com': GITHUB_FINGERPRINT,
        'custom.example.com': 'SHA256:customfingerprint',
      };

      const result = getKnownHosts(hosts);

      expect(result['github.com']).toBe(GITHUB_FINGERPRINT);
      expect(result['custom.example.com']).toBe('SHA256:customfingerprint');
    });

    it('should handle undefined hosts', () => {
      const result = getKnownHosts(undefined);

      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('verifyHostKey', () => {
    it('should return true for valid GitHub host key', () => {
      const knownHosts: KnownHostsConfig = { 'github.com': GITHUB_FINGERPRINT };

      const result = verifyHostKey('github.com', GITHUB_FINGERPRINT, knownHosts);

      expect(result).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return true for valid GitLab host key', () => {
      const knownHosts: KnownHostsConfig = { 'gitlab.com': GITLAB_FINGERPRINT };

      const result = verifyHostKey('gitlab.com', GITLAB_FINGERPRINT, knownHosts);

      expect(result).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return false for unknown hostname', () => {
      const knownHosts: KnownHostsConfig = { 'github.com': GITHUB_FINGERPRINT };

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
      const knownHosts: KnownHostsConfig = { 'github.com': GITHUB_FINGERPRINT };
      const wrongFingerprint = 'SHA256:wrongfingerprint';

      const result = verifyHostKey('github.com', wrongFingerprint, knownHosts);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Host key verification failed for'),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Expected: ${GITHUB_FINGERPRINT}`),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Received: ${wrongFingerprint}`),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARNING: This could indicate a man-in-the-middle attack!'),
      );
    });

    it('should verify custom host keys', () => {
      const knownHosts: KnownHostsConfig = {
        'custom.example.com': 'SHA256:customfingerprint123',
      };

      const result = verifyHostKey('custom.example.com', 'SHA256:customfingerprint123', knownHosts);

      expect(result).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should reject custom host with wrong fingerprint', () => {
      const knownHosts: KnownHostsConfig = {
        'custom.example.com': 'SHA256:customfingerprint123',
      };

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
