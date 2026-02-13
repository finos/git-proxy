/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, it, expect, assert } from 'vitest';
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
            type: 'fs',
            enabled: true,
          },
        ],
      };

      const result = Convert.toGitProxyConfig(JSON.stringify(validConfig));

      assert.isObject(result);
      expect(result.proxyUrl).toBe('https://proxy.example.com');
      expect(result.cookieSecret).toBe('test-secret');
      assert.isArray(result.authorisedList);
      assert.isArray(result.authentication);
      assert.isArray(result.sink);
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

      assert.isObject(parsed);
      expect(parsed.proxyUrl).toBe('https://proxy.example.com');
      expect(parsed.cookieSecret).toBe('test-secret');
    });

    it('should handle empty configuration object', () => {
      const emptyConfig = {};

      const result = Convert.toGitProxyConfig(JSON.stringify(emptyConfig));
      assert.isObject(result);
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

      assert.isObject(result);
      assert.isArray(result.authentication);
      assert.isArray(result.authorisedList);
      assert.isString(result.contactEmail);
      assert.isString(result.cookieSecret);
      assert.isBoolean(result.csrfProtection);
      assert.isArray(result.plugins);
      assert.isArray(result.privateOrganizations);
      assert.isString(result.proxyUrl);
      assert.isObject(result.rateLimit);
      assert.isNumber(result.sessionMaxAgeHours);
      assert.isArray(result.sink);
    });

    it('should handle malformed configuration gracefully', () => {
      const malformedConfig = {
        proxyUrl: 123, // Wrong type
        authentication: 'not-an-array', // Wrong type
      };

      assert.throws(() => Convert.toGitProxyConfig(JSON.stringify(malformedConfig)));
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
        sink: [{ type: 'fs', enabled: true }],
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
        sink: [{ type: 'fs', enabled: true }],
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

      assert.isObject(result.tls);
      assert.isBoolean(result.tls!.enabled);
      assert.isObject(result.rateLimit);
      assert.isObject(result.tempPassword);
    });

    it('should handle complex validation scenarios', () => {
      // Test configuration that will trigger more validation paths
      const complexConfig = {
        proxyUrl: 'https://proxy.example.com',
        cookieSecret: 'secret',
        authentication: [{ type: 'local', enabled: true }],
        sink: [{ type: 'fs', enabled: true }],

        api: {
          ls: {
            userInADGroup:
              'https://somedomain.com/some/path/checkUserGroups?domain=<domain>&name=<name>&id=<id>',
          },
        },

        domains: {
          localhost: 'http://localhost:3000',
          'example.com': 'https://example.com',
        },

        // Complex nested structures
        attestationConfig: {
          questions: [
            {
              label: 'Test Question',
              tooltip: {
                text: 'Test tooltip content',
                links: [{ text: 'Test link', url: 'https://git-proxy.finos.org./' }],
              },
            },
          ],
        },
      };

      const result = Convert.toGitProxyConfig(JSON.stringify(complexConfig));
      assert.isObject(result);
      assert.isObject(result.api);
      assert.isObject(result.domains);
    });

    it('should handle array validation edge cases', () => {
      const configWithArrays = {
        proxyUrl: 'https://proxy.example.com',
        cookieSecret: 'secret',
        authentication: [{ type: 'local', enabled: true }],
        sink: [{ type: 'fs', enabled: true }],

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
        sink: [{ type: 'fs', enabled: true }],

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
      assert.isObject(result.tempPassword);
      expect(result.tempPassword!.length).toBe(12);
    });

    it('should test validation error paths', () => {
      assert.throws(() =>
        Convert.toGitProxyConfig('{"proxyUrl": 123, "authentication": "not-array"}'),
      );
    });

    it('should test date and null handling', () => {
      // Test that null values cause validation errors (covers error paths)
      const configWithNulls = {
        proxyUrl: 'https://proxy.example.com',
        cookieSecret: null,
        authentication: [{ type: 'local', enabled: true }],
        sink: [{ type: 'fs', enabled: true }],
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
        sink: [{ type: 'fs', enabled: true }],
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
      assert.isObject(reparsed.rateLimit);
    });

    it('should validate the default configuration from proxy.config.json', () => {
      // This test ensures that the default config always passes QuickType validation
      // This catches cases where schema updates haven't been reflected in the default config
      const result = Convert.toGitProxyConfig(JSON.stringify(defaultSettings));

      assert.isObject(result);
      assert.isString(result.cookieSecret);
      assert.isArray(result.authorisedList);
      assert.isArray(result.authentication);
      assert.isArray(result.sink);

      // Validate that serialization also works
      const serialized = Convert.gitProxyConfigToJson(result);
      expect(() => JSON.parse(serialized)).not.toThrow();
    });
  });
});
