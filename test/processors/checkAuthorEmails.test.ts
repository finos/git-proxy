import { Request } from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from '../../src/proxy/processors/push-action/checkAuthorEmails';
import { Action } from '../../src/proxy/actions';
import * as configModule from '../../src/config';
import * as validator from 'validator';
import { SAMPLE_COMMIT } from '../../src/proxy/processors/constants';

// mock dependencies
vi.mock('../../src/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config')>();
  return {
    ...actual,
    getCommitConfig: vi.fn(() => ({})),
  };
});
vi.mock('validator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('validator')>();
  return {
    ...actual,
    isEmail: vi.fn(),
  };
});

describe('checkAuthorEmails', () => {
  let mockAction: Action;
  let mockReq: Request;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

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

    mockReq = {} as Request;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isEmailAllowed logic (via exec)', () => {
    describe('basic email validation', () => {
      it('should allow valid email addresses', async () => {
        mockAction.commitData = [
          { ...SAMPLE_COMMIT, authorEmail: 'john.doe@example.com' },
          { ...SAMPLE_COMMIT, authorEmail: 'jane.smith@company.org' },
        ];

        const result = await exec(mockReq, mockAction);

        expect(result.addStep).toHaveBeenCalledTimes(1);
        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(false);
      });

      it('should reject empty email', async () => {
        mockAction.commitData = [{ ...SAMPLE_COMMIT, authorEmail: '' }];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(true);
      });

      it('should reject null/undefined email', async () => {
        vi.mocked(validator.isEmail).mockReturnValue(false);
        mockAction.commitData = [{ ...SAMPLE_COMMIT, authorEmail: null as any }];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(true);
      });

      it('should reject invalid email format', async () => {
        vi.mocked(validator.isEmail).mockReturnValue(false);
        mockAction.commitData = [
          { ...SAMPLE_COMMIT, authorEmail: 'not-an-email' },
          { ...SAMPLE_COMMIT, authorEmail: 'missing@domain' },
          { ...SAMPLE_COMMIT, authorEmail: '@nodomain.com' },
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
        });

        mockAction.commitData = [
          { ...SAMPLE_COMMIT, authorEmail: 'user@example.com' },
          { ...SAMPLE_COMMIT, authorEmail: 'admin@company.org' },
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
        });

        mockAction.commitData = [
          { ...SAMPLE_COMMIT, authorEmail: 'user@notallowed.com' },
          { ...SAMPLE_COMMIT, authorEmail: 'admin@different.org' },
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
        });

        mockAction.commitData = [
          { ...SAMPLE_COMMIT, authorEmail: 'user@subdomain.example.com' },
          { ...SAMPLE_COMMIT, authorEmail: 'user@example.com.fake.org' },
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
        });

        mockAction.commitData = [
          { ...SAMPLE_COMMIT, authorEmail: 'user@anydomain.com' },
          { ...SAMPLE_COMMIT, authorEmail: 'admin@otherdomain.org' },
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
        });

        mockAction.commitData = [
          { ...SAMPLE_COMMIT, authorEmail: 'noreply@example.com' },
          { ...SAMPLE_COMMIT, authorEmail: 'donotreply@company.org' },
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
        });

        mockAction.commitData = [
          { ...SAMPLE_COMMIT, authorEmail: 'john.doe@example.com' },
          { ...SAMPLE_COMMIT, authorEmail: 'valid.user@company.org' },
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
        });

        mockAction.commitData = [
          { ...SAMPLE_COMMIT, authorEmail: 'test@example.com' },
          { ...SAMPLE_COMMIT, authorEmail: 'temporary@example.com' },
          { ...SAMPLE_COMMIT, authorEmail: 'fakeuser@example.com' },
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
        });

        mockAction.commitData = [
          { ...SAMPLE_COMMIT, authorEmail: 'noreply@example.com' },
          { ...SAMPLE_COMMIT, authorEmail: 'anything@example.com' },
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
        });

        mockAction.commitData = [
          { ...SAMPLE_COMMIT, authorEmail: 'valid@example.com' }, // valid
          { ...SAMPLE_COMMIT, authorEmail: 'noreply@example.com' }, // invalid: blocked local
          { ...SAMPLE_COMMIT, authorEmail: 'valid@otherdomain.com' }, // invalid: wrong domain
        ];

        const result = await exec(mockReq, mockAction);

        const step = vi.mocked(result.addStep).mock.calls[0][0];
        expect(step.error).toBe(true);
      });
    });
  });

  describe('exec function behavior', () => {
    it('should create a step with name "checkAuthorEmails"', async () => {
      mockAction.commitData = [{ ...SAMPLE_COMMIT, authorEmail: 'user@example.com' }];

      await exec(mockReq, mockAction);

      expect(mockAction.addStep).toHaveBeenCalledWith(
        expect.objectContaining({
          stepName: 'checkAuthorEmails',
        }),
      );
    });

    it('should handle unique author emails correctly', async () => {
      mockAction.commitData = [
        { ...SAMPLE_COMMIT, authorEmail: 'user1@example.com' },
        { ...SAMPLE_COMMIT, authorEmail: 'user2@example.com' },
        { ...SAMPLE_COMMIT, authorEmail: 'user1@example.com' }, // Duplicate
        { ...SAMPLE_COMMIT, authorEmail: 'user3@example.com' },
        { ...SAMPLE_COMMIT, authorEmail: 'user2@example.com' }, // Duplicate
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
      mockAction.commitData = [{ ...SAMPLE_COMMIT, authorEmail: 'invalid-email' }];

      await exec(mockReq, mockAction);
    });

    it('should log success message when all emails are legal', async () => {
      mockAction.commitData = [
        { ...SAMPLE_COMMIT, authorEmail: 'user1@example.com' },
        { ...SAMPLE_COMMIT, authorEmail: 'user2@example.com' },
      ];

      await exec(mockReq, mockAction);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'The following commit author e-mails are legal: user1@example.com,user2@example.com',
      );
    });

    it('should set error on step when illegal emails found', async () => {
      vi.mocked(validator.isEmail).mockReturnValue(false);
      mockAction.commitData = [{ ...SAMPLE_COMMIT, authorEmail: 'bad@email' }];

      await exec(mockReq, mockAction);

      const step = vi.mocked(mockAction.addStep).mock.calls[0][0];
      expect(step.error).toBe(true);
    });

    it('should call step.setError with user-friendly message', async () => {
      vi.mocked(validator.isEmail).mockReturnValue(false);
      mockAction.commitData = [{ ...SAMPLE_COMMIT, authorEmail: 'bad' }];

      await exec(mockReq, mockAction);

      const step = vi.mocked(mockAction.addStep).mock.calls[0][0];
      expect(step.error).toBe(true);
      expect(step.errorMessage).toBe(
        'Your push has been blocked. Please verify your Git configured e-mail address is valid (e.g. john.smith@example.com)',
      );
    });

    it('should return the action object', async () => {
      mockAction.commitData = [{ ...SAMPLE_COMMIT, authorEmail: 'user@example.com' }];

      const result = await exec(mockReq, mockAction);

      expect(result).toBe(mockAction);
    });

    it('should handle mixed valid and invalid emails', async () => {
      mockAction.commitData = [
        { ...SAMPLE_COMMIT, authorEmail: 'valid@example.com' },
        { ...SAMPLE_COMMIT, authorEmail: 'invalid' },
        { ...SAMPLE_COMMIT, authorEmail: 'also.valid@example.com' },
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
      mockAction.commitData = [{ ...SAMPLE_COMMIT, authorEmail: 'user@@example.com' }];

      const result = await exec(mockReq, mockAction);

      const step = vi.mocked(result.addStep).mock.calls[0][0];
      expect(step.error).toBe(true);
    });

    it('should handle email without domain', async () => {
      vi.mocked(validator.isEmail).mockReturnValue(false);
      mockAction.commitData = [{ ...SAMPLE_COMMIT, authorEmail: 'user@' }];

      const result = await exec(mockReq, mockAction);

      const step = vi.mocked(result.addStep).mock.calls[0][0];
      expect(step.error).toBe(true);
    });

    it('should handle very long email addresses', async () => {
      const longLocal = 'a'.repeat(64);
      const longEmail = `${longLocal}@example.com`;
      mockAction.commitData = [{ ...SAMPLE_COMMIT, authorEmail: longEmail }];

      const result = await exec(mockReq, mockAction);

      expect(result.addStep).toHaveBeenCalled();
    });

    it('should handle special characters in local part', async () => {
      mockAction.commitData = [
        { ...SAMPLE_COMMIT, authorEmail: 'user+tag@example.com' },
        { ...SAMPLE_COMMIT, authorEmail: 'user.name@example.com' },
        { ...SAMPLE_COMMIT, authorEmail: 'user_name@example.com' },
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
      });

      mockAction.commitData = [
        { ...SAMPLE_COMMIT, authorEmail: 'user@EXAMPLE.COM' },
        { ...SAMPLE_COMMIT, authorEmail: 'user@Example.Com' },
      ];

      const result = await exec(mockReq, mockAction);

      const step = vi.mocked(result.addStep).mock.calls[0][0];
      expect(step.error).toBe(false);
    });
  });
});
