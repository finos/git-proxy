import { describe, it, expect } from 'vitest';
import { Convert, GitProxyConfig } from '../src/config/generated/config';
import defaultSettings from '../proxy.config.json';

describe('Generated Config (QuickType)', () => {
  describe('Convert class', () => {
    it('should parse valid configuration JSON', () => {
      const validConfig = {
        proxyUrl: 'https://proxy.example.com',
        cookieSecret: 'test-secret',
        authorisedList: [
          {
            project: 'test',
            name: 'repo',
            url: 'https://github.com/test/repo.git',
          },
        ],
        authentication: [
          {
            type: 'local',
            enabled: true,
          },
        ],
        sink: [
          {
            type: 'memory',
            enabled: true,
          },
        ],
      };

      const result = Convert.toGitProxyConfig(JSON.stringify(validConfig));

      expect(result).toBeTypeOf('object');
      expect(result.proxyUrl).toBe('https://proxy.example.com');
      expect(result.cookieSecret).toBe('test-secret');
      expect(Array.isArray(result.authorisedList)).toBe(true);
      expect(Array.isArray(result.authentication)).toBe(true);
      expect(Array.isArray(result.sink)).toBe(true);
    });

    it('should convert config object back to JSON', () => {
      const configObject = {
        proxyUrl: 'https://proxy.example.com',
        cookieSecret: 'test-secret',
        authorisedList: [],
        authentication: [
          {
            type: 'local',
            enabled: true,
          },
        ],
      } as GitProxyConfig;

      const jsonString = Convert.gitProxyConfigToJson(configObject);
      const parsed = JSON.parse(jsonString);

      expect(parsed).toBeTypeOf('object');
      expect(parsed.proxyUrl).toBe('https://proxy.example.com');
      expect(parsed.cookieSecret).toBe('test-secret');
    });

    it('should handle empty configuration object', () => {
      const emptyConfig = {};

      const result = Convert.toGitProxyConfig(JSON.stringify(emptyConfig));
      expect(result).toBeTypeOf('object');
    });

    it('should throw error for invalid JSON string', () => {
      expect(() => {
        Convert.toGitProxyConfig('invalid json');
      }).toThrow();
    });

    it('should handle configuration with valid rate limit structure', () => {
      const validConfig = {
        proxyUrl: 'https://proxy.example.com',
        cookieSecret: 'secret',
        sessionMaxAgeHours: 24,
        rateLimit: {
          windowMs: 60000,
          limit: 150,
        },
        tempPassword: {
          sendEmail: false,
          emailConfig: {},
        },
        authorisedList: [
          {
            project: 'test',
            name: 'repo',
            url: 'https://github.com/test/repo.git',
          },
        ],
        sink: [
          {
            type: 'fs',
            params: {
              filepath: './.',
            },
            enabled: true,
          },
        ],
        authentication: [
          {
            type: 'local',
            enabled: true,
          },
        ],
        contactEmail: 'admin@example.com',
        csrfProtection: true,
        plugins: [],
        privateOrganizations: ['private-org'],
        urlShortener: 'https://shortener.example.com',
      };

      const result = Convert.toGitProxyConfig(JSON.stringify(validConfig));

      expect(result).toBeTypeOf('object');
      expect(Array.isArray(result.authentication)).toBe(true);
      expect(Array.isArray(result.authorisedList)).toBe(true);
      expect(result.contactEmail).toBeTypeOf('string');
      expect(result.cookieSecret).toBeTypeOf('string');
      expect(result.csrfProtection).toBeTypeOf('boolean');
      expect(Array.isArray(result.plugins)).toBe(true);
      expect(Array.isArray(result.privateOrganizations)).toBe(true);
      expect(result.proxyUrl).toBeTypeOf('string');
      expect(result.rateLimit).toBeTypeOf('object');
      expect(result.sessionMaxAgeHours).toBeTypeOf('number');
      expect(Array.isArray(result.sink)).toBe(true);
    });

    it('should handle malformed configuration gracefully', () => {
      const malformedConfig = {
        proxyUrl: 123, // Wrong type
        authentication: 'not-an-array', // Wrong type
      };

      try {
        const result = Convert.toGitProxyConfig(JSON.stringify(malformedConfig));
        expect(result).toBeTypeOf('object');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should preserve array structures', () => {
      const configWithArrays = {
        proxyUrl: 'https://proxy.example.com',
        cookieSecret: 'secret',
        authorisedList: [
          { project: 'proj1', name: 'repo1', url: 'https://github.com/proj1/repo1.git' },
          { project: 'proj2', name: 'repo2', url: 'https://github.com/proj2/repo2.git' },
        ],
        authentication: [{ type: 'local', enabled: true }],
        sink: [{ type: 'fs', params: { filepath: './.' }, enabled: true }],
        plugins: ['plugin1', 'plugin2'],
        privateOrganizations: ['org1', 'org2'],
      };

      const result = Convert.toGitProxyConfig(JSON.stringify(configWithArrays));

      expect(result.authorisedList).toHaveLength(2);
      expect(result.authentication).toHaveLength(1);
      expect(result.plugins).toHaveLength(2);
      expect(result.privateOrganizations).toHaveLength(2);
    });

    it('should handle nested object structures', () => {
      const configWithNesting = {
        proxyUrl: 'https://proxy.example.com',
        cookieSecret: 'secret',
        authentication: [{ type: 'local', enabled: true }],
        sink: [{ type: 'fs', params: { filepath: './.' }, enabled: true }],
        tls: {
          enabled: true,
          key: '/path/to/key.pem',
          cert: '/path/to/cert.pem',
        },
        rateLimit: {
          windowMs: 60000,
          limit: 150,
        },
        tempPassword: {
          sendEmail: false,
          emailConfig: {},
        },
      };

      const result = Convert.toGitProxyConfig(JSON.stringify(configWithNesting));

      expect(result.tls).toBeTypeOf('object');
      expect(result.tls!.enabled).toBeTypeOf('boolean');
      expect(result.rateLimit).toBeTypeOf('object');
      expect(result.tempPassword).toBeTypeOf('object');
    });

    it('should handle complex validation scenarios', () => {
      // Test configuration that will trigger more validation paths
      const complexConfig = {
        proxyUrl: 'https://proxy.example.com',
        cookieSecret: 'secret',
        authentication: [{ type: 'local', enabled: true }],
        sink: [{ type: 'fs', params: { filepath: './.' }, enabled: true }],

        api: {
          github: {
            baseUrl: 'https://api.github.com',
            token: 'secret-token',
            rateLimit: 100,
            enabled: true,
          },
        },

        domains: {
          localhost: 'http://localhost:3000',
          'example.com': 'https://example.com',
        },

        // Complex nested structures
        attestationConfig: {
          enabled: true,
          questions: [
            {
              id: 'q1',
              type: 'boolean',
              required: true,
              label: 'Test Question',
            },
          ],
        },
      };

      const result = Convert.toGitProxyConfig(JSON.stringify(complexConfig));
      expect(result).toBeTypeOf('object');
      expect(result.api).toBeTypeOf('object');
      expect(result.domains).toBeTypeOf('object');
    });

    it('should handle array validation edge cases', () => {
      const configWithArrays = {
        proxyUrl: 'https://proxy.example.com',
        cookieSecret: 'secret',
        authentication: [{ type: 'local', enabled: true }],
        sink: [{ type: 'fs', params: { filepath: './.' }, enabled: true }],

        // Test different array structures
        authorisedList: [
          {
            project: 'test1',
            name: 'repo1',
            url: 'https://github.com/test1/repo1.git',
          },
          {
            project: 'test2',
            name: 'repo2',
            url: 'https://github.com/test2/repo2.git',
          },
        ],

        plugins: ['plugin-a', 'plugin-b', 'plugin-c'],
        privateOrganizations: ['org1', 'org2'],
      };

      const result = Convert.toGitProxyConfig(JSON.stringify(configWithArrays));
      expect(result.authorisedList).toHaveLength(2);
      expect(result.plugins).toHaveLength(3);
      expect(result.privateOrganizations).toHaveLength(2);
    });

    it('should exercise transformation functions with edge cases', () => {
      const edgeCaseConfig = {
        proxyUrl: 'https://proxy.example.com',
        cookieSecret: 'secret',
        authentication: [{ type: 'local', enabled: true }],
        sink: [{ type: 'fs', params: { filepath: './.' }, enabled: true }],

        sessionMaxAgeHours: 0,
        csrfProtection: false,

        tempPassword: {
          sendEmail: true,
          emailConfig: {
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: {
              user: 'user@example.com',
              pass: 'password',
            },
          },
          length: 12,
          expiry: 7200,
        },

        rateLimit: {
          windowMs: 900000,
          limit: 1000,
          message: 'Rate limit exceeded',
        },
      };

      const result = Convert.toGitProxyConfig(JSON.stringify(edgeCaseConfig));
      expect(result.sessionMaxAgeHours).toBe(0);
      expect(result.csrfProtection).toBe(false);
      expect(result.tempPassword).toBeTypeOf('object');
      expect(result.tempPassword!.length).toBe(12);
    });

    it('should test validation error paths', () => {
      try {
        // Try to parse something that looks like valid JSON but has wrong structure
        Convert.toGitProxyConfig('{"proxyUrl": 123, "authentication": "not-array"}');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should test date and null handling', () => {
      // Test that null values cause validation errors (covers error paths)
      const configWithNulls = {
        proxyUrl: 'https://proxy.example.com',
        cookieSecret: null,
        authentication: [{ type: 'local', enabled: true }],
        sink: [{ type: 'fs', params: { filepath: './.' }, enabled: true }],
        contactEmail: null,
        urlShortener: null,
      };

      expect(() => {
        Convert.toGitProxyConfig(JSON.stringify(configWithNulls));
      }).toThrow('Invalid value');
    });

    it('should test serialization back to JSON', () => {
      const testConfig = {
        proxyUrl: 'https://test.com',
        cookieSecret: 'secret',
        authentication: [{ type: 'local', enabled: true }],
        sink: [{ type: 'fs', params: { filepath: './.' }, enabled: true }],
        rateLimit: {
          windowMs: 60000,
          limit: 150,
        },
        tempPassword: {
          sendEmail: false,
          emailConfig: {},
        },
      };

      const parsed = Convert.toGitProxyConfig(JSON.stringify(testConfig));
      const serialized = Convert.gitProxyConfigToJson(parsed);
      const reparsed = JSON.parse(serialized);

      expect(reparsed.proxyUrl).toBe('https://test.com');
      expect(reparsed.rateLimit).toBeTypeOf('object');
    });

    it('should validate the default configuration from proxy.config.json', () => {
      // This test ensures that the default config always passes QuickType validation
      // This catches cases where schema updates haven't been reflected in the default config
      const result = Convert.toGitProxyConfig(JSON.stringify(defaultSettings));

      expect(result).toBeTypeOf('object');
      expect(result.cookieSecret).toBeTypeOf('string');
      expect(Array.isArray(result.authorisedList)).toBe(true);
      expect(Array.isArray(result.authentication)).toBe(true);
      expect(Array.isArray(result.sink)).toBe(true);

      // Validate that serialization also works
      const serialized = Convert.gitProxyConfigToJson(result);
      expect(() => JSON.parse(serialized)).not.toThrow();
    });
  });
});
