import { describe, expect, it } from 'vitest';
import {
  getServiceError,
  formatErrorMessage,
  errorResult,
  successResult,
} from '../../src/ui/services/errors';

describe('errors utility functions', () => {
  describe('getServiceError', () => {
    it('extracts status and message from axios error response', () => {
      const error = {
        response: {
          status: 404,
          data: {
            message: 'Not found',
          },
        },
      };

      const result = getServiceError(error, 'Fallback message');

      expect(result).toEqual({
        status: 404,
        message: 'Not found',
      });
    });

    it('uses error.message when response message is not available', () => {
      const error = {
        message: 'Network error',
      };

      const result = getServiceError(error, 'Fallback message');

      expect(result).toEqual({
        status: undefined,
        message: 'Network error',
      });
    });

    it('uses fallback message when no message is available', () => {
      const error = {};

      const result = getServiceError(error, 'Fallback message');

      expect(result).toEqual({
        status: undefined,
        message: 'Fallback message',
      });
    });

    it('ignores empty string response messages', () => {
      const error = {
        response: {
          status: 500,
          data: {
            message: '   ',
          },
        },
        message: 'Server error',
      };

      const result = getServiceError(error, 'Fallback message');

      expect(result).toEqual({
        status: 500,
        message: 'Server error',
      });
    });

    it('ignores non-string response messages', () => {
      const error = {
        response: {
          status: 400,
          data: {
            message: { error: 'Bad request' },
          },
        },
        message: 'Bad request error',
      };

      const result = getServiceError(error, 'Fallback message');

      expect(result).toEqual({
        status: 400,
        message: 'Bad request error',
      });
    });
  });

  describe('formatErrorMessage', () => {
    it('formats message with status code', () => {
      const result = formatErrorMessage('Error loading data', 404, 'Not found');

      expect(result).toBe('Error loading data: 404 Not found');
    });

    it('formats message without status code', () => {
      const result = formatErrorMessage('Error loading data', undefined, 'Network error');

      expect(result).toBe('Error loading data: Network error');
    });

    it('handles status code 0', () => {
      const result = formatErrorMessage('Error', 0, 'Connection refused');

      expect(result).toBe('Error: Connection refused');
    });
  });

  describe('errorResult', () => {
    it('creates error result from axios error', () => {
      const error = {
        response: {
          status: 403,
          data: {
            message: 'Forbidden',
          },
        },
      };

      const result = errorResult(error, 'Failed to access resource');

      expect(result).toEqual({
        success: false,
        status: 403,
        message: 'Forbidden',
      });
    });

    it('creates error result with fallback message', () => {
      const error = {};

      const result = errorResult(error, 'Something went wrong');

      expect(result).toEqual({
        success: false,
        status: undefined,
        message: 'Something went wrong',
      });
    });

    it('preserves type parameter', () => {
      const error = {
        message: 'Error',
      };

      const result = errorResult<{ data: string }>(error, 'Failed');

      expect(result).toEqual({
        success: false,
        status: undefined,
        message: 'Error',
      });
    });
  });

  describe('successResult', () => {
    it('creates success result without data', () => {
      const result = successResult();

      expect(result).toEqual({
        success: true,
      });
    });

    it('creates success result with data', () => {
      const data = { id: '123', name: 'test' };
      const result = successResult(data);

      expect(result).toEqual({
        success: true,
        data: { id: '123', name: 'test' },
      });
    });

    it('creates success result with null data', () => {
      const result = successResult(null);

      expect(result).toEqual({
        success: true,
        data: null,
      });
    });

    it('creates success result with 0 as data', () => {
      const result = successResult(0);

      expect(result).toEqual({
        success: true,
        data: 0,
      });
    });

    it('creates success result with false as data', () => {
      const result = successResult(false);

      expect(result).toEqual({
        success: true,
        data: false,
      });
    });

    it('creates success result with empty string as data', () => {
      const result = successResult('');

      expect(result).toEqual({
        success: true,
        data: '',
      });
    });

    it('does not include data key when undefined', () => {
      const result = successResult(undefined);

      expect(result).toEqual({
        success: true,
      });
      expect('data' in result).toBe(false);
    });
  });
});
