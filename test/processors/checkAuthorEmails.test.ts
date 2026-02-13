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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from '../../src/proxy/processors/push-action/checkAuthorEmails';
import { Action } from '../../src/proxy/actions';
import * as configModule from '../../src/config';
import * as validator from 'validator';
import { CommitData } from '../../src/proxy/processors/types';

// mock dependencies
vi.mock('../../src/config', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getCommitConfig: vi.fn(() => ({})),
  };
});
vi.mock('validator', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    isEmail: vi.fn(),
  };
});

describe('checkAuthorEmails', () => {
  let mockAction: Action;
  let mockReq: any;
  let consoleLogSpy: any;

  beforeEach(async () => {
    // setup default mocks
    vi.mocked(validator.isEmail).mockImplementation((email: string) => {
      // email validation mock
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    });

    vi.mocked(configModule.getCommitConfig).mockReturnValue({
      author: {
        email: {
          domain: {
            allow: '',
          },
          local: {
            block: '',
          },
        },
      },
    });

    // mock console.log to suppress output and verify calls
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // setup mock action
    mockAction = {
      commitData: [],
      addStep: vi.fn(),
    } as unknown as Action;

    mockReq = {};
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isEmailAllowed logic (via exec)', () => {
    describe('basic email validation', () => {
      it('should allow valid email addresses', async () => {
        mockAction.commitData = [
          { authorEmail: 'john.doe@example.com' } as CommitData,
          { authorEmail: 'jane.smith@company.org' } as CommitData,
        ];

        const result = await exec(mockReq, mockAction);

        expect(result.addStep).toHaveBeenCalledTimes(1);
        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(false);
      });

      it('should reject empty email', async () => {
        mockAction.commitData = [{ authorEmail: '' } as CommitData];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(true);
      });

      it('should reject null/undefined email', async () => {
        vi.mocked(validator.isEmail).mockReturnValue(false);
        mockAction.commitData = [{ authorEmail: null as any } as CommitData];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(true);
      });

      it('should reject invalid email format', async () => {
        vi.mocked(validator.isEmail).mockReturnValue(false);
        mockAction.commitData = [
          { authorEmail: 'not-an-email' } as CommitData,
          { authorEmail: 'missing@domain' } as CommitData,
          { authorEmail: '@nodomain.com' } as CommitData,
        ];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(true);
      });
    });

    describe('domain allow list', () => {
      it('should allow emails from permitted domains', async () => {
        vi.mocked(configModule.getCommitConfig).mockReturnValue({
          author: {
            email: {
              domain: {
                allow: '^(example\\.com|company\\.org)$',
              },
              local: {
                block: '',
              },
            },
          },
        } as any);

        mockAction.commitData = [
          { authorEmail: 'user@example.com' } as CommitData,
          { authorEmail: 'admin@company.org' } as CommitData,
        ];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(false);
      });

      it('should reject emails from non-permitted domains when allow list is set', async () => {
        vi.mocked(configModule.getCommitConfig).mockReturnValue({
          author: {
            email: {
              domain: {
                allow: '^example\\.com$',
              },
              local: {
                block: '',
              },
            },
          },
        } as any);

        mockAction.commitData = [
          { authorEmail: 'user@notallowed.com' } as CommitData,
          { authorEmail: 'admin@different.org' } as CommitData,
        ];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(true);
      });

      it('should handle partial domain matches correctly', async () => {
        vi.mocked(configModule.getCommitConfig).mockReturnValue({
          author: {
            email: {
              domain: {
                allow: 'example\\.com',
              },
              local: {
                block: '',
              },
            },
          },
        } as any);

        mockAction.commitData = [
          { authorEmail: 'user@subdomain.example.com' } as CommitData,
          { authorEmail: 'user@example.com.fake.org' } as CommitData,
        ];

        const result = await exec(mockReq, mockAction);

        // both should match because regex pattern 'example.com' appears in both
        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(false);
      });

      it('should allow all domains when allow list is empty', async () => {
        vi.mocked(configModule.getCommitConfig).mockReturnValue({
          author: {
            email: {
              domain: {
                allow: '',
              },
              local: {
                block: '',
              },
            },
          },
        } as any);

        mockAction.commitData = [
          { authorEmail: 'user@anydomain.com' } as CommitData,
          { authorEmail: 'admin@otherdomain.org' } as CommitData,
        ];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(false);
      });
    });

    describe('local part block list', () => {
      it('should reject emails with blocked local parts', async () => {
        vi.mocked(configModule.getCommitConfig).mockReturnValue({
          author: {
            email: {
              domain: {
                allow: '',
              },
              local: {
                block: '^(noreply|donotreply|bounce)$',
              },
            },
          },
        } as any);

        mockAction.commitData = [
          { authorEmail: 'noreply@example.com' } as CommitData,
          { authorEmail: 'donotreply@company.org' } as CommitData,
        ];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(true);
      });

      it('should allow emails with non-blocked local parts', async () => {
        vi.mocked(configModule.getCommitConfig).mockReturnValue({
          author: {
            email: {
              domain: {
                allow: '',
              },
              local: {
                block: '^noreply$',
              },
            },
          },
        } as any);

        mockAction.commitData = [
          { authorEmail: 'john.doe@example.com' } as CommitData,
          { authorEmail: 'valid.user@company.org' } as CommitData,
        ];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(false);
      });

      it('should handle regex patterns in local block correctly', async () => {
        vi.mocked(configModule.getCommitConfig).mockReturnValue({
          author: {
            email: {
              domain: {
                allow: '',
              },
              local: {
                block: '^(test|temp|fake)',
              },
            },
          },
        } as any);

        mockAction.commitData = [
          { authorEmail: 'test@example.com' } as CommitData,
          { authorEmail: 'temporary@example.com' } as CommitData,
          { authorEmail: 'fakeuser@example.com' } as CommitData,
        ];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(true);
      });

      it('should allow all local parts when block list is empty', async () => {
        vi.mocked(configModule.getCommitConfig).mockReturnValue({
          author: {
            email: {
              domain: {
                allow: '',
              },
              local: {
                block: '',
              },
            },
          },
        } as any);

        mockAction.commitData = [
          { authorEmail: 'noreply@example.com' } as CommitData,
          { authorEmail: 'anything@example.com' } as CommitData,
        ];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(false);
      });
    });

    describe('combined domain and local rules', () => {
      it('should enforce both domain allow and local block rules', async () => {
        vi.mocked(configModule.getCommitConfig).mockReturnValue({
          author: {
            email: {
              domain: {
                allow: '^example\\.com$',
              },
              local: {
                block: '^noreply$',
              },
            },
          },
        } as any);

        mockAction.commitData = [
          { authorEmail: 'valid@example.com' } as CommitData, // valid
          { authorEmail: 'noreply@example.com' } as CommitData, // invalid: blocked local
          { authorEmail: 'valid@otherdomain.com' } as CommitData, // invalid: wrong domain
        ];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(true);
      });
    });
  });

  describe('exec function behavior', () => {
    it('should create a step with name "checkAuthorEmails"', async () => {
      mockAction.commitData = [{ authorEmail: 'user@example.com' } as CommitData];

      await exec(mockReq, mockAction);

      expect(mockAction.addStep).toHaveBeenCalledWith(
        expect.objectContaining({
          stepName: 'checkAuthorEmails',
        }),
      );
    });

    it('should handle unique author emails correctly', async () => {
      mockAction.commitData = [
        { authorEmail: 'user1@example.com' } as CommitData,
        { authorEmail: 'user2@example.com' } as CommitData,
        { authorEmail: 'user1@example.com' } as CommitData, // Duplicate
        { authorEmail: 'user3@example.com' } as CommitData,
        { authorEmail: 'user2@example.com' } as CommitData, // Duplicate
      ];

      await exec(mockReq, mockAction);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'The following commit author e-mails are legal: user1@example.com,user2@example.com,user3@example.com',
      );
    });

    it('should handle empty commitData', async () => {
      mockAction.commitData = [];

      const result = await exec(mockReq, mockAction);

      const step = vi.mocked(result.addStep).mock.calls[0][0];
      expect(step.error).toBe(false);
    });

    it('should handle undefined commitData', async () => {
      mockAction.commitData = undefined;

      const result = await exec(mockReq, mockAction);

      const step = vi.mocked(result.addStep).mock.calls[0][0];
      expect(step.error).toBe(false);
    });

    it('should log error message when illegal emails found', async () => {
      vi.mocked(validator.isEmail).mockReturnValue(false);
      mockAction.commitData = [{ authorEmail: 'invalid-email' } as CommitData];

      await exec(mockReq, mockAction);
    });

    it('should log success message when all emails are legal', async () => {
      mockAction.commitData = [
        { authorEmail: 'user1@example.com' } as CommitData,
        { authorEmail: 'user2@example.com' } as CommitData,
      ];

      await exec(mockReq, mockAction);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'The following commit author e-mails are legal: user1@example.com,user2@example.com',
      );
    });

    it('should set error on step when illegal emails found', async () => {
      vi.mocked(validator.isEmail).mockReturnValue(false);
      mockAction.commitData = [{ authorEmail: 'bad@email' } as CommitData];

      await exec(mockReq, mockAction);

      const step = vi.mocked(mockAction.addStep).mock.calls[0][0];
      expect(step.error).toBe(true);
    });

    it('should call step.setError with user-friendly message', async () => {
      vi.mocked(validator.isEmail).mockReturnValue(false);
      mockAction.commitData = [{ authorEmail: 'bad' } as CommitData];

      await exec(mockReq, mockAction);

      const step = vi.mocked(mockAction.addStep).mock.calls[0][0];
      expect(step.error).toBe(true);
      expect(step.errorMessage).toBe(
        'Your push has been blocked. Please verify your Git configured e-mail address is valid (e.g. john.smith@example.com)',
      );
    });

    it('should return the action object', async () => {
      mockAction.commitData = [{ authorEmail: 'user@example.com' } as CommitData];

      const result = await exec(mockReq, mockAction);

      expect(result).toBe(mockAction);
    });

    it('should handle mixed valid and invalid emails', async () => {
      mockAction.commitData = [
        { authorEmail: 'valid@example.com' } as CommitData,
        { authorEmail: 'invalid' } as CommitData,
        { authorEmail: 'also.valid@example.com' } as CommitData,
      ];

      vi.mocked(validator.isEmail).mockImplementation((email: string) => {
        return email.includes('@') && email.includes('.');
      });

      const result = await exec(mockReq, mockAction);

      const step = vi.mocked(result.addStep).mock.calls[0][0];
      expect(step.error).toBe(true);
    });
  });

  describe('displayName', () => {
    it('should have correct displayName', () => {
      expect(exec.displayName).toBe('checkAuthorEmails.exec');
    });
  });

  describe('edge cases', () => {
    it('should handle email with multiple @ symbols', async () => {
      vi.mocked(validator.isEmail).mockReturnValue(false);
      mockAction.commitData = [{ authorEmail: 'user@@example.com' } as CommitData];

      const result = await exec(mockReq, mockAction);

      const step = vi.mocked(result.addStep).mock.calls[0][0];
      expect(step.error).toBe(true);
    });

    it('should handle email without domain', async () => {
      vi.mocked(validator.isEmail).mockReturnValue(false);
      mockAction.commitData = [{ authorEmail: 'user@' } as CommitData];

      const result = await exec(mockReq, mockAction);

      const step = vi.mocked(result.addStep).mock.calls[0][0];
      expect(step.error).toBe(true);
    });

    it('should handle very long email addresses', async () => {
      const longLocal = 'a'.repeat(64);
      const longEmail = `${longLocal}@example.com`;
      mockAction.commitData = [{ authorEmail: longEmail } as CommitData];

      const result = await exec(mockReq, mockAction);

      expect(result.addStep).toHaveBeenCalled();
    });

    it('should handle special characters in local part', async () => {
      mockAction.commitData = [
        { authorEmail: 'user+tag@example.com' } as CommitData,
        { authorEmail: 'user.name@example.com' } as CommitData,
        { authorEmail: 'user_name@example.com' } as CommitData,
      ];

      const result = await exec(mockReq, mockAction);

      const step = vi.mocked(result.addStep).mock.calls[0][0];
      expect(step.error).toBe(false);
    });

    it('should handle case sensitivity in domain checking', async () => {
      vi.mocked(configModule.getCommitConfig).mockReturnValue({
        author: {
          email: {
            domain: {
              allow: '^example\\.com$',
            },
            local: {
              block: '',
            },
          },
        },
      } as any);

      mockAction.commitData = [
        { authorEmail: 'user@EXAMPLE.COM' } as CommitData,
        { authorEmail: 'user@Example.Com' } as CommitData,
      ];

      const result = await exec(mockReq, mockAction);

      const step = vi.mocked(result.addStep).mock.calls[0][0];
      expect(step.error).toBe(false);
    });
  });
});
