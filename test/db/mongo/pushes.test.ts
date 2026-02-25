import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';

const mockFindOneDocument = vi.fn();
const mockUpdateOne = vi.fn();
const mockConnect = vi.fn(() => ({
  updateOne: mockUpdateOne,
}));

vi.mock('../../../src/db/mongo/helper', () => ({
  connect: mockConnect,
  findOneDocument: mockFindOneDocument,
}));

describe('MongoDB - Pushes', async () => {
  const { reject, authorise, getPush } = await import('../../../src/db/mongo/pushes');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('reject', () => {
    it('should reject a push with rejection metadata', async () => {
      const pushId = 'test-push-123';
      const mockPush = {
        id: pushId,
        authorised: false,
        canceled: false,
        rejected: false,
      };

      const rejection = {
        reason: 'Code does not meet quality standards',
        timestamp: new Date(),
        reviewer: {
          username: 'reviewer1',
          reviewerEmail: 'reviewer1@example.com',
        },
      };

      mockFindOneDocument.mockResolvedValue(mockPush);
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await reject(pushId, rejection);

      expect(result).toEqual({ message: `reject ${pushId}` });
      expect(mockFindOneDocument).toHaveBeenCalledWith('pushes', { id: pushId });
      expect(mockConnect).toHaveBeenCalledWith('pushes');

      const [query, update, options] = mockUpdateOne.mock.calls[0];

      expect(query).toEqual({ id: pushId });
      expect(options).toEqual({ upsert: true });
      expect(update.$set).toMatchObject({
        id: pushId,
        authorised: false,
        canceled: false,
        rejected: true,
        rejection: {
          reason: rejection.reason,
          reviewer: rejection.reviewer,
        },
      });
    });

    it('should throw an error if push is not found', async () => {
      const pushId = 'non-existent-push';

      mockFindOneDocument.mockResolvedValue(null);

      const rejection = {
        reason: 'Test reason',
        timestamp: new Date(),
        reviewer: {
          username: 'reviewer1',
          reviewerEmail: 'reviewer1@example.com',
        },
      };

      await expect(reject(pushId, rejection)).rejects.toThrow(`push ${pushId} not found`);
      expect(mockFindOneDocument).toHaveBeenCalledWith('pushes', { id: pushId });
    });
  });
});
