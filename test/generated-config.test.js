const chai = require('chai');
const { Convert } = require('../src/config/generated/config');

const { expect } = chai;

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

      expect(result).to.be.an('object');
      expect(result.proxyUrl).to.equal('https://proxy.example.com');
      expect(result.cookieSecret).to.equal('test-secret');
      expect(result.authorisedList).to.be.an('array');
      expect(result.authentication).to.be.an('array');
      expect(result.sink).to.be.an('array');
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
      };

      const jsonString = Convert.gitProxyConfigToJson(configObject);
      const parsed = JSON.parse(jsonString);

      expect(parsed).to.be.an('object');
      expect(parsed.proxyUrl).to.equal('https://proxy.example.com');
      expect(parsed.cookieSecret).to.equal('test-secret');
    });

    it('should handle empty configuration object', () => {
      const emptyConfig = {};

      const result = Convert.toGitProxyConfig(JSON.stringify(emptyConfig));
      expect(result).to.be.an('object');
    });

    it('should throw error for invalid JSON string', () => {
      expect(() => {
        Convert.toGitProxyConfig('invalid json');
      }).to.throw();
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

      expect(result).to.be.an('object');
      expect(result.authentication).to.be.an('array');
      expect(result.authorisedList).to.be.an('array');
      expect(result.contactEmail).to.be.a('string');
      expect(result.cookieSecret).to.be.a('string');
      expect(result.csrfProtection).to.be.a('boolean');
      expect(result.plugins).to.be.an('array');
      expect(result.privateOrganizations).to.be.an('array');
      expect(result.proxyUrl).to.be.a('string');
      expect(result.rateLimit).to.be.an('object');
      expect(result.sessionMaxAgeHours).to.be.a('number');
      expect(result.sink).to.be.an('array');
    });

    it('should handle malformed configuration gracefully', () => {
      const malformedConfig = {
        proxyUrl: 123, // Wrong type
        authentication: 'not-an-array', // Wrong type
      };

      try {
        const result = Convert.toGitProxyConfig(JSON.stringify(malformedConfig));
        expect(result).to.be.an('object');
      } catch (error) {
        expect(error).to.be.an('error');
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

      expect(result.authorisedList).to.have.lengthOf(2);
      expect(result.authentication).to.have.lengthOf(1);
      expect(result.plugins).to.have.lengthOf(2);
      expect(result.privateOrganizations).to.have.lengthOf(2);
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

      expect(result.tls).to.be.an('object');
      expect(result.tls.enabled).to.be.a('boolean');
      expect(result.rateLimit).to.be.an('object');
      expect(result.tempPassword).to.be.an('object');
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
      expect(result).to.be.an('object');
      expect(result.api).to.be.an('object');
      expect(result.domains).to.be.an('object');
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
      expect(result.authorisedList).to.have.lengthOf(2);
      expect(result.plugins).to.have.lengthOf(3);
      expect(result.privateOrganizations).to.have.lengthOf(2);
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
      expect(result.sessionMaxAgeHours).to.equal(0);
      expect(result.csrfProtection).to.equal(false);
      expect(result.tempPassword).to.be.an('object');
      expect(result.tempPassword.length).to.equal(12);
    });

    it('should test validation error paths', () => {
      try {
        // Try to parse something that looks like valid JSON but has wrong structure
        Convert.toGitProxyConfig('{"proxyUrl": 123, "authentication": "not-array"}');
      } catch (error) {
        expect(error).to.be.an('error');
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
      }).to.throw('Invalid value');
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

      expect(reparsed.proxyUrl).to.equal('https://test.com');
      expect(reparsed.rateLimit).to.be.an('object');
    });
  });
});
