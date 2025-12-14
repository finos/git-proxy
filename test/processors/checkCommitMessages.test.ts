import { Request } from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from '../../src/proxy/processors/push-action/checkCommitMessages';
import { Action } from '../../src/proxy/actions';
import * as configModule from '../../src/config';
import { SAMPLE_COMMIT } from '../../src/proxy/processors/constants';

vi.mock('../../src/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/config')>();
  return {
    ...actual,
    getCommitConfig: vi.fn(() => ({})),
  };
});

describe('checkCommitMessages', () => {
  let action: Action;
  let req: Request;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let mockCommitConfig: any;

  beforeEach(() => {
    // spy on console.log to verify calls
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // default mock config
    mockCommitConfig = {
      message: {
        block: {
          literals: ['password', 'secret', 'token'],
          patterns: ['http://.*', 'https://.*'],
        },
      },
    };

    vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

    action = new Action('test', 'test', 'test', 1, 'test');
    req = {} as Request;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isMessageAllowed', () => {
    describe('Empty or invalid messages', () => {
      it('should block empty string commit messages', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: '' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith('No commit message included...');
      });

      it('should block null commit messages', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: null as unknown as string }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block undefined commit messages', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: undefined as unknown as string }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block non-string commit messages', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 123 as unknown as string }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          'A non-string value has been captured for the commit message...',
        );
      });

      it('should block object commit messages', async () => {
        action.commitData = [
          { ...SAMPLE_COMMIT, message: { text: 'fix: bug' } as unknown as string },
        ];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block array commit messages', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: ['fix: bug'] as unknown as string }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });
    });

    describe('Blocked literals', () => {
      it('should block messages containing blocked literals (exact case)', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'Add password to config' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Commit message is blocked via configured literals/patterns...',
        );
      });

      it('should block messages containing blocked literals (case insensitive)', async () => {
        action.commitData = [
          { ...SAMPLE_COMMIT, message: 'Add PASSWORD to config' },
          { ...SAMPLE_COMMIT, message: 'Store Secret key' },
          { ...SAMPLE_COMMIT, message: 'Update TOKEN value' },
        ];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block messages with literals in the middle of words', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'Update mypassword123' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block when multiple literals are present', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'Add password and secret token' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });
    });

    describe('Blocked patterns', () => {
      it('should block messages containing http URLs', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'See http://example.com for details' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block messages containing https URLs', async () => {
        action.commitData = [
          { ...SAMPLE_COMMIT, message: 'Update docs at https://docs.example.com' },
        ];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block messages with multiple URLs', async () => {
        action.commitData = [
          { ...SAMPLE_COMMIT, message: 'See http://example.com and https://other.com' },
        ];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should handle custom regex patterns', async () => {
        mockCommitConfig.message.block.patterns = ['\\d{3}-\\d{2}-\\d{4}'];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        action.commitData = [{ ...SAMPLE_COMMIT, message: 'SSN: 123-45-6789' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should match patterns case-insensitively', async () => {
        mockCommitConfig.message.block.patterns = ['PRIVATE'];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        action.commitData = [{ ...SAMPLE_COMMIT, message: 'This is private information' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });
    });

    describe('Combined blocking (literals and patterns)', () => {
      it('should block when both literals and patterns match', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'password at http://example.com' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block when only literals match', async () => {
        mockCommitConfig.message.block.patterns = [];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        action.commitData = [{ ...SAMPLE_COMMIT, message: 'Add secret key' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block when only patterns match', async () => {
        mockCommitConfig.message.block.literals = [];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        action.commitData = [{ ...SAMPLE_COMMIT, message: 'Visit http://example.com' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });
    });

    describe('Allowed messages', () => {
      it('should allow valid commit messages', async () => {
        action.commitData = [
          { ...SAMPLE_COMMIT, message: 'fix: resolve bug in user authentication' },
        ];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(false);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('The following commit messages are legal:'),
        );
      });

      it('should allow messages with no blocked content', async () => {
        action.commitData = [
          { ...SAMPLE_COMMIT, message: 'feat: add new feature' },
          { ...SAMPLE_COMMIT, message: 'chore: update dependencies' },
          { ...SAMPLE_COMMIT, message: 'docs: improve documentation' },
        ];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should allow messages when config has empty block lists', async () => {
        mockCommitConfig.message.block.literals = [];
        mockCommitConfig.message.block.patterns = [];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        action.commitData = [{ ...SAMPLE_COMMIT, message: 'Any message should pass' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(false);
      });
    });

    describe('Multiple commits', () => {
      it('should handle multiple valid commits', async () => {
        action.commitData = [
          { ...SAMPLE_COMMIT, message: 'feat: add feature A' },
          { ...SAMPLE_COMMIT, message: 'fix: resolve issue B' },
          { ...SAMPLE_COMMIT, message: 'chore: update config C' },
        ];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should block when any commit is invalid', async () => {
        action.commitData = [
          { ...SAMPLE_COMMIT, message: 'feat: add feature A' },
          { ...SAMPLE_COMMIT, message: 'fix: add password to config' },
          { ...SAMPLE_COMMIT, message: 'chore: update config C' },
        ];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block when multiple commits are invalid', async () => {
        action.commitData = [
          { ...SAMPLE_COMMIT, message: 'Add password' },
          { ...SAMPLE_COMMIT, message: 'Store secret' },
          { ...SAMPLE_COMMIT, message: 'feat: valid message' },
        ];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should deduplicate commit messages', async () => {
        action.commitData = [
          { ...SAMPLE_COMMIT, message: 'fix: bug' },
          { ...SAMPLE_COMMIT, message: 'fix: bug' },
        ];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should handle mix of duplicate valid and invalid messages', async () => {
        action.commitData = [
          { ...SAMPLE_COMMIT, message: 'fix: bug' },
          { ...SAMPLE_COMMIT, message: 'Add password' },
          { ...SAMPLE_COMMIT, message: 'fix: bug' },
        ];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });
    });

    describe('Error handling and logging', () => {
      it('should set error flag on step when messages are illegal', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'Add password' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should log error message to step', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'Add password' }];

        const result = await exec(req, action);
        const step = result.steps[0];

        // first log is the "push blocked" message
        expect(step.logs[1]).toContain(
          'The following commit messages are illegal: ["Add password"]',
        );
      });

      it('should set detailed error message', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'Add secret' }];

        const result = await exec(req, action);
        const step = result.steps[0];

        expect(step.errorMessage).toContain('Your push has been blocked');
        expect(step.errorMessage).toContain('Add secret');
      });

      it('should include all illegal messages in error', async () => {
        action.commitData = [
          { ...SAMPLE_COMMIT, message: 'Add password' },
          { ...SAMPLE_COMMIT, message: 'Store token' },
        ];

        const result = await exec(req, action);
        const step = result.steps[0];

        expect(step.errorMessage).toContain('Add password');
        expect(step.errorMessage).toContain('Store token');
      });
    });

    describe('Edge cases', () => {
      it('should handle action with no commitData', async () => {
        action.commitData = undefined;

        const result = await exec(req, action);

        // should handle gracefully
        expect(result.steps).toHaveLength(1);
      });

      it('should handle action with empty commitData array', async () => {
        action.commitData = [];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should handle whitespace-only messages', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: '   ' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should handle very long commit messages', async () => {
        const longMessage = 'fix: ' + 'a'.repeat(10000);
        action.commitData = [{ ...SAMPLE_COMMIT, message: longMessage }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should handle special regex characters in literals', async () => {
        mockCommitConfig.message.block.literals = ['$pecial', 'char*'];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        action.commitData = [{ ...SAMPLE_COMMIT, message: 'Contains $pecial characters' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should handle unicode characters in messages', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'feat: 添加新功能 🎉' }];

        const result = await exec(req, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should handle malformed regex patterns gracefully', async () => {
        mockCommitConfig.message.block.patterns = ['[invalid'];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        action.commitData = [{ ...SAMPLE_COMMIT, message: 'Any message' }];

        // test that it doesn't crash
        expect(() => exec(req, action)).not.toThrow();
      });
    });

    describe('Function properties', () => {
      it('should have displayName property', () => {
        expect(exec.displayName).toBe('checkCommitMessages.exec');
      });
    });

    describe('Step management', () => {
      it('should create a step named "checkCommitMessages"', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'fix: bug' }];

        const result = await exec(req, action);

        expect(result.steps[0].stepName).toBe('checkCommitMessages');
      });

      it('should add step to action', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'fix: bug' }];

        const initialStepCount = action.steps.length;
        const result = await exec(req, action);

        expect(result.steps.length).toBe(initialStepCount + 1);
      });

      it('should return the same action object', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'fix: bug' }];

        const result = await exec(req, action);

        expect(result).toBe(action);
      });
    });

    describe('Request parameter', () => {
      it('should accept request parameter without using it', async () => {
        action.commitData = [{ ...SAMPLE_COMMIT, message: 'fix: bug' }];
        const mockRequest = { headers: {}, body: {} };

        const result = await exec(mockRequest as Request, action);

        expect(result.steps[0].error).toBe(false);
      });
    });
  });
});
