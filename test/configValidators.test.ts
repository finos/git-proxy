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
import { validateConfig, validateScmProviders } from '../src/config/validators';
import { GitProxyConfig, SCMProviderType } from '../src/config/generated/config';

describe('validators', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('validateConfig', () => {
    it('should return true for empty config', () => {
      const config: GitProxyConfig = {};
      expect(validateConfig(config)).toBe(true);
    });

    it('should return true for config without commitConfig', () => {
      const config: GitProxyConfig = {
        proxyUrl: 'https://test.com',
        cookieSecret: 'secret',
      };
      expect(validateConfig(config)).toBe(true);
    });

    it('should return true for valid commitConfig with all valid regex patterns', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          author: {
            email: {
              local: {
                block: '^admin.*',
              },
              domain: {
                allow: '.*@example\\.com$',
              },
            },
          },
          message: {
            block: {
              patterns: ['^WIP:', 'TODO', '[Tt]est'],
            },
          },
          diff: {
            block: {
              patterns: ['password', 'secret.*key'],
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should return false when commitConfig.author.email.local.block has invalid regex', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          author: {
            email: {
              local: {
                block: '[invalid(regex',
              },
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid regular expression for commitConfig.author.email.local.block: [invalid(regex',
      );
    });

    it('should return false when commitConfig.author.email.domain.allow has invalid regex', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          author: {
            email: {
              domain: {
                allow: '(unclosed group',
              },
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid regular expression for commitConfig.author.email.domain.allow: (unclosed group',
      );
    });

    it('should return false when commitConfig.message.block.patterns contains invalid regex', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          message: {
            block: {
              patterns: ['valid-pattern', '[invalid[bracket', 'another-valid'],
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid regular expression for commitConfig.message.block.patterns: [invalid[bracket',
      );
    });

    it('should return false when commitConfig.diff.block.patterns contains invalid regex', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          diff: {
            block: {
              patterns: ['password', '*invalid-quantifier'],
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid regular expression for commitConfig.diff.block.patterns: *invalid-quantifier',
      );
    });

    it('should return false on first invalid pattern in message.block.patterns array', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          message: {
            block: {
              patterns: ['[invalid1', '[invalid2'],
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(false);
      // Only logs the first invalid pattern
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid regular expression for commitConfig.message.block.patterns: [invalid1',
      );
    });

    it('should validate all regex fields independently', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          author: {
            email: {
              local: {
                block: '^valid.*',
              },
              domain: {
                allow: '.*@valid\\.com$',
              },
            },
          },
          message: {
            block: {
              patterns: ['valid-message'],
            },
          },
          diff: {
            block: {
              patterns: ['valid-diff'],
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle partial commitConfig with only author.email.local.block', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          author: {
            email: {
              local: {
                block: '^admin',
              },
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle partial commitConfig with only author.email.domain.allow', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          author: {
            email: {
              domain: {
                allow: 'example\\.com',
              },
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle partial commitConfig with only message.block.patterns', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          message: {
            block: {
              patterns: ['WIP', 'TODO'],
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle partial commitConfig with only diff.block.patterns', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          diff: {
            block: {
              patterns: ['password', 'secret'],
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle empty providers object for diff.block.providers', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          diff: {
            block: {
              providers: {},
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle empty patterns array for message.block.patterns', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          message: {
            block: {
              patterns: [],
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle empty patterns array for diff.block.patterns', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          diff: {
            block: {
              patterns: [],
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should validate complex regex patterns correctly', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          author: {
            email: {
              local: {
                block: '^(?!.*[._]{2})(?!^[._])(?!.*[._]$)[a-z0-9._]+$',
              },
              domain: {
                allow: '^([a-z0-9]+(-[a-z0-9]+)*\\.)+[a-z]{2,}$',
              },
            },
          },
          message: {
            block: {
              patterns: [
                '\\b(password|secret|api[_-]?key)\\b',
                '^(fixup!|squash!)',
                '\\[skip[\\s-]ci\\]',
              ],
            },
          },
          diff: {
            block: {
              patterns: [
                '-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----',
                '(AWS|aws)_?(SECRET|secret)_?(ACCESS|access)_?(KEY|key)',
              ],
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle invalid regex with special characters', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          author: {
            email: {
              local: {
                block: '???',
              },
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid regular expression for commitConfig.author.email.local.block: ???',
      );
    });

    it('should stop validation at first error and return false', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          author: {
            email: {
              local: {
                block: '[invalid',
              },
              domain: {
                allow: '(also-invalid',
              },
            },
          },
          message: {
            block: {
              patterns: ['*invalid-too'],
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(false);
      // Stops at first error (local.block)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid regular expression for commitConfig.author.email.local.block: [invalid',
      );
    });

    it('should handle regex with unicode characters', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          message: {
            block: {
              patterns: ['[\\u4e00-\\u9fff]+', '\\p{Emoji}'],
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle invalid regex with special characters in providers', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          diff: {
            block: {
              providers: { type: '???' },
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid regular expression for commitConfig.diff.block.providers: ???',
      );
    });

    it('should work with valid regex in providers', () => {
      const config: GitProxyConfig = {
        commitConfig: {
          diff: {
            block: {
              providers: { type: 'valid' },
            },
          },
        },
      };
      expect(validateConfig(config)).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('validateScmProviders', () => {
    const ok = (scmProviders: GitProxyConfig['scmProviders']) =>
      validateScmProviders({ scmProviders } as GitProxyConfig);

    it('accepts the built-in defaults', () => {
      expect(
        ok([
          { name: 'github', type: SCMProviderType.Github, host: 'github.com' },
          { name: 'gitlab', type: SCMProviderType.Gitlab, host: 'gitlab.com' },
          { name: 'codeberg', type: SCMProviderType.Forgejo, host: 'codeberg.org' },
          { name: 'gitea', type: SCMProviderType.Forgejo, host: 'gitea.com' },
        ]),
      ).toBe(true);
    });

    it('accepts an empty or missing list', () => {
      expect(ok([])).toBe(true);
      expect(validateScmProviders({} as GitProxyConfig)).toBe(true);
    });

    it.each([
      ['github.com', SCMProviderType.Forgejo],
      ['GitHub.com', SCMProviderType.Gitlab],
      ['octo.ghe.com', SCMProviderType.Forgejo],
      ['gitlab.com', SCMProviderType.Forgejo],
      ['gitlab.com', SCMProviderType.Github],
      ['codeberg.org', SCMProviderType.Gitlab],
      ['gitea.com', SCMProviderType.Github],
    ])('refuses %s configured as type %s', (host, type) => {
      expect(ok([{ name: 'x', type, host }])).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('cannot be configured as type'),
      );
    });

    it('takes self-hosted hosts as configured', () => {
      expect(
        ok([
          { name: 'ghes', type: SCMProviderType.Github, host: 'github.example.com' },
          { name: 'gerrit', type: SCMProviderType.Forgejo, host: 'gerrit.example.com' },
          { name: 'forge', type: SCMProviderType.Forgejo, host: 'forge.example.com' },
        ]),
      ).toBe(true);
    });

    it('refuses duplicate names and duplicate hosts', () => {
      expect(
        ok([
          { name: 'a', type: SCMProviderType.Github, host: 'github.com' },
          { name: 'a', type: SCMProviderType.Gitlab, host: 'gitlab.com' },
        ]),
      ).toBe(false);
      expect(
        ok([
          { name: 'a', type: SCMProviderType.Forgejo, host: 'git.example.com' },
          { name: 'b', type: SCMProviderType.Forgejo, host: 'GIT.example.com' },
        ]),
      ).toBe(false);
    });

    it('refuses an entry without a name or host', () => {
      expect(ok([{ name: '', type: SCMProviderType.Forgejo, host: 'git.example.com' }])).toBe(
        false,
      );
      expect(ok([{ name: 'x', type: SCMProviderType.Forgejo, host: '' }])).toBe(false);
    });

    it('is part of validateConfig', () => {
      expect(
        validateConfig({
          scmProviders: [{ name: 'x', type: SCMProviderType.Forgejo, host: 'github.com' }],
        } as GitProxyConfig),
      ).toBe(false);
    });
  });
});
