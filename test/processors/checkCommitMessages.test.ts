import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from '../../src/proxy/processors/push-action/checkCommitMessages';
import { Action } from '../../src/proxy/actions';
import * as configModule from '../../src/config';
import { Commit } from '../../src/proxy/actions/Action';

vi.mock('../../src/config', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getCommitConfig: vi.fn(() => ({})),
  };
});

describe('checkCommitMessages', () => {
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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isMessageAllowed', () => {
    describe('Empty or invalid messages', () => {
      it('should block empty string commit messages', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: '' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith('No commit message included...');
      });

      it('should block null commit messages', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: null as any } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block undefined commit messages', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: undefined as any } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block non-string commit messages', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 123 as any } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          'A non-string value has been captured for the commit message...',
        );
      });

      it('should block object commit messages', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: { text: 'fix: bug' } as any } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block array commit messages', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: ['fix: bug'] as any } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });
    });

    describe('Blocked literals', () => {
      it('should block messages containing blocked literals (exact case)', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'Add password to config' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          'Commit message is blocked via configured literals/patterns...',
        );
      });

      it('should block messages containing blocked literals (case insensitive)', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [
          { message: 'Add PASSWORD to config' } as Commit,
          { message: 'Store Secret key' } as Commit,
          { message: 'Update TOKEN value' } as Commit,
        ];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block messages with literals in the middle of words', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'Update mypassword123' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block when multiple literals are present', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'Add password and secret token' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });
    });

    describe('Blocked patterns', () => {
      it('should block messages containing http URLs', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'See http://example.com for details' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block messages containing https URLs', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'Update docs at https://docs.example.com' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block messages with multiple URLs', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'See http://example.com and https://other.com' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should handle custom regex patterns', async () => {
        mockCommitConfig.message.block.patterns = ['\\d{3}-\\d{2}-\\d{4}'];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'SSN: 123-45-6789' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should match patterns case-insensitively', async () => {
        mockCommitConfig.message.block.patterns = ['PRIVATE'];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'This is private information' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });
    });

    describe('Combined blocking (literals and patterns)', () => {
      it('should block when both literals and patterns match', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'password at http://example.com' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block when only literals match', async () => {
        mockCommitConfig.message.block.patterns = [];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'Add secret key' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block when only patterns match', async () => {
        mockCommitConfig.message.block.literals = [];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'Visit http://example.com' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });
    });

    describe('Allowed messages', () => {
      it('should allow valid commit messages', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'fix: resolve bug in user authentication' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(false);
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('The following commit messages are legal:'),
        );
      });

      it('should allow messages with no blocked content', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [
          { message: 'feat: add new feature' } as Commit,
          { message: 'chore: update dependencies' } as Commit,
          { message: 'docs: improve documentation' } as Commit,
        ];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should allow messages when config has empty block lists', async () => {
        mockCommitConfig.message.block.literals = [];
        mockCommitConfig.message.block.patterns = [];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'Any message should pass' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(false);
      });
    });

    describe('Multiple commits', () => {
      it('should handle multiple valid commits', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [
          { message: 'feat: add feature A' } as Commit,
          { message: 'fix: resolve issue B' } as Commit,
          { message: 'chore: update config C' } as Commit,
        ];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should block when any commit is invalid', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [
          { message: 'feat: add feature A' } as Commit,
          { message: 'fix: add password to config' } as Commit,
          { message: 'chore: update config C' } as Commit,
        ];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should block when multiple commits are invalid', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [
          { message: 'Add password' } as Commit,
          { message: 'Store secret' } as Commit,
          { message: 'feat: valid message' } as Commit,
        ];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should deduplicate commit messages', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'fix: bug' } as Commit, { message: 'fix: bug' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should handle mix of duplicate valid and invalid messages', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [
          { message: 'fix: bug' } as Commit,
          { message: 'Add password' } as Commit,
          { message: 'fix: bug' } as Commit,
        ];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });
    });

    describe('Error handling and logging', () => {
      it('should set error flag on step when messages are illegal', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'Add password' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should log error message to step', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'Add password' } as Commit];

        const result = await exec({}, action);
        const step = result.steps[0];

        // first log is the "push blocked" message
        expect(step.logs[1]).toContain(
          'The following commit messages are illegal: ["Add password"]',
        );
      });

      it('should set detailed error message', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'Add secret' } as Commit];

        const result = await exec({}, action);
        const step = result.steps[0];

        expect(step.errorMessage).toContain('Your push has been blocked');
        expect(step.errorMessage).toContain('Add secret');
      });

      it('should include all illegal messages in error', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [
          { message: 'Add password' } as Commit,
          { message: 'Store token' } as Commit,
        ];

        const result = await exec({}, action);
        const step = result.steps[0];

        expect(step.errorMessage).toContain('Add password');
        expect(step.errorMessage).toContain('Store token');
      });
    });

    describe('Edge cases', () => {
      it('should handle action with no commitData', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = undefined;

        const result = await exec({}, action);

        // should handle gracefully
        expect(result.steps).toHaveLength(1);
      });

      it('should handle action with empty commitData array', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should handle whitespace-only messages', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: '   ' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should handle very long commit messages', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        const longMessage = 'fix: ' + 'a'.repeat(10000);
        action.commitData = [{ message: longMessage } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should handle special regex characters in literals', async () => {
        mockCommitConfig.message.block.literals = ['$pecial', 'char*'];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'Contains $pecial characters' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(true);
      });

      it('should handle unicode characters in messages', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'feat: 添加新功能 🎉' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].error).toBe(false);
      });

      it('should handle malformed regex patterns gracefully', async () => {
        mockCommitConfig.message.block.patterns = ['[invalid'];
        vi.mocked(configModule.getCommitConfig).mockReturnValue(mockCommitConfig);

        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'Any message' } as Commit];

        // test that it doesn't crash
        expect(() => exec({}, action)).not.toThrow();
      });
    });

    describe('Function properties', () => {
      it('should have displayName property', () => {
        expect(exec.displayName).toBe('checkCommitMessages.exec');
      });
    });

    describe('Step management', () => {
      it('should create a step named "checkCommitMessages"', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'fix: bug' } as Commit];

        const result = await exec({}, action);

        expect(result.steps[0].stepName).toBe('checkCommitMessages');
      });

      it('should add step to action', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'fix: bug' } as Commit];

        const initialStepCount = action.steps.length;
        const result = await exec({}, action);

        expect(result.steps.length).toBe(initialStepCount + 1);
      });

      it('should return the same action object', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'fix: bug' } as Commit];

        const result = await exec({}, action);

        expect(result).toBe(action);
      });
    });

    describe('Request parameter', () => {
      it('should accept request parameter without using it', async () => {
        const action = new Action('test', 'test', 'test', 1, 'test');
        action.commitData = [{ message: 'fix: bug' } as Commit];
        const mockRequest = { headers: {}, body: {} };

        const result = await exec(mockRequest, action);

        expect(result.steps[0].error).toBe(false);
      });
    });
  });
});
