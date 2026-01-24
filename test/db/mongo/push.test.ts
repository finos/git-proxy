import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { Action } from '../../../src/proxy/actions';

const mockFindOne = vi.fn();
const mockDeleteOne = vi.fn();
const mockUpdateOne = vi.fn();
const mockFind = vi.fn();

const mockConnect = vi.fn(() => ({
  findOne: mockFindOne,
  deleteOne: mockDeleteOne,
  updateOne: mockUpdateOne,
  find: mockFind,
}));

const mockFindDocuments = vi.fn();
const mockFindOneDocument = vi.fn();

vi.mock('../../../src/db/mongo/helper', () => ({
  connect: mockConnect,
  findDocuments: mockFindDocuments,
  findOneDocument: mockFindOneDocument,
}));

const mockToClass = vi.fn((doc, proto) => Object.assign(Object.create(proto), doc));

vi.mock('../../../src/db/helper', () => ({
  toClass: mockToClass,
}));

describe('MongoDB Push Handler', async () => {
  const { getPushes, getPush, deletePush, writeAudit, authorise, reject, cancel } = await import(
    '../../../src/db/mongo/pushes'
  );

  const TEST_PUSH = {
    id: 'test-push-123',
    allowPush: false,
    authorised: false,
    blocked: true,
    blockedMessage: 'Test blocked message',
    branch: 'main',
    canceled: false,
    commitData: [],
    commitFrom: 'abc123',
    commitTo: 'def456',
    error: false,
    method: 'POST',
    project: 'test-project',
    rejected: false,
    repo: 'test-repo',
    repoName: 'test-repo-name',
    timestamp: 1744380903338,
    type: 'push',
    url: 'https://example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPushes', () => {
    it('should get pushes with default query', async () => {
      const mockPushes = [TEST_PUSH];
      mockFindDocuments.mockResolvedValue(mockPushes);

      const result = await getPushes();

      expect(mockFindDocuments).toHaveBeenCalledWith(
        'pushes',
        {
          error: false,
          blocked: true,
          allowPush: false,
          authorised: false,
          type: 'push',
        },
        {
          projection: {
            _id: 0,
            id: 1,
            allowPush: 1,
            authorised: 1,
            blocked: 1,
            blockedMessage: 1,
            branch: 1,
            canceled: 1,
            commitData: 1,
            commitFrom: 1,
            commitTo: 1,
            error: 1,
            method: 1,
            project: 1,
            rejected: 1,
            repo: 1,
            repoName: 1,
            timepstamp: 1,
            type: 1,
            url: 1,
          },
        },
      );
      expect(result).toEqual(mockPushes);
    });

    it('should get pushes with custom query', async () => {
      const customQuery = { error: true };
      const mockPushes = [TEST_PUSH];
      mockFindDocuments.mockResolvedValue(mockPushes);

      const result = await getPushes(customQuery);

      expect(mockFindDocuments).toHaveBeenCalledWith(
        'pushes',
        customQuery,
        expect.objectContaining({
          projection: expect.any(Object),
        }),
      );
      expect(result).toEqual(mockPushes);
    });
  });

  describe('getPush', () => {
    it('should get a single push by id', async () => {
      mockFindOneDocument.mockResolvedValue(TEST_PUSH);

      const result = await getPush(TEST_PUSH.id);

      expect(mockFindOneDocument).toHaveBeenCalledWith('pushes', { id: TEST_PUSH.id });
      expect(mockToClass).toHaveBeenCalledWith(TEST_PUSH, Action.prototype);
      expect(result).toBeTruthy();
    });

    it('should return null when push not found', async () => {
      mockFindOneDocument.mockResolvedValue(null);

      const result = await getPush('non-existent-id');

      expect(mockFindOneDocument).toHaveBeenCalledWith('pushes', { id: 'non-existent-id' });
      expect(result).toBeNull();
      expect(mockToClass).not.toHaveBeenCalled();
    });
  });

  describe('deletePush', () => {
    it('should delete a push by id', async () => {
      mockDeleteOne.mockResolvedValue({ deletedCount: 1 });

      await deletePush(TEST_PUSH.id);

      expect(mockConnect).toHaveBeenCalledWith('pushes');
      expect(mockDeleteOne).toHaveBeenCalledWith({ id: TEST_PUSH.id });
    });
  });

  describe('writeAudit', () => {
    it('should write audit data', async () => {
      const action = { ...TEST_PUSH, _id: 'some-mongo-id' } as any;
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await writeAudit(action);

      expect(mockConnect).toHaveBeenCalledWith('pushes');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { id: TEST_PUSH.id },
        {
          $set: expect.objectContaining({
            id: TEST_PUSH.id,
            allowPush: TEST_PUSH.allowPush,
            authorised: TEST_PUSH.authorised,
          }),
        },
        { upsert: true },
      );

      const updateCall = mockUpdateOne.mock.calls[0];
      expect(updateCall[1].$set).not.toHaveProperty('_id');
    });

    it('should throw error if id is not a string', async () => {
      const action = { ...TEST_PUSH, id: 123 } as any;

      await expect(writeAudit(action)).rejects.toThrow('Invalid id');
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });
  });

  describe('authorise', () => {
    it('should authorise a push', async () => {
      mockFindOneDocument.mockResolvedValue({ ...TEST_PUSH });
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const attestation = { signature: 'test-sig' };
      const result = await authorise(TEST_PUSH.id, attestation);

      expect(mockFindOneDocument).toHaveBeenCalledWith('pushes', { id: TEST_PUSH.id });
      expect(mockConnect).toHaveBeenCalledWith('pushes');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { id: TEST_PUSH.id },
        {
          $set: expect.objectContaining({
            authorised: true,
            canceled: false,
            rejected: false,
            attestation: attestation,
          }),
        },
        { upsert: true },
      );
      expect(result).toEqual({ message: `authorised ${TEST_PUSH.id}` });
    });

    it('should throw error when push not found', async () => {
      mockFindOneDocument.mockResolvedValue(null);

      await expect(authorise('non-existent-id', null)).rejects.toThrow(
        'push non-existent-id not found',
      );
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('should reject a push', async () => {
      mockFindOneDocument.mockResolvedValue({ ...TEST_PUSH });
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const attestation = { signature: 'test-sig' };
      const result = await reject(TEST_PUSH.id, attestation);

      expect(mockFindOneDocument).toHaveBeenCalledWith('pushes', { id: TEST_PUSH.id });
      expect(mockConnect).toHaveBeenCalledWith('pushes');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { id: TEST_PUSH.id },
        {
          $set: expect.objectContaining({
            authorised: false,
            canceled: false,
            rejected: true,
            attestation: attestation,
          }),
        },
        { upsert: true },
      );
      expect(result).toEqual({ message: `reject ${TEST_PUSH.id}` });
    });

    it('should throw error when push not found', async () => {
      mockFindOneDocument.mockResolvedValue(null);

      await expect(reject('non-existent-id', null)).rejects.toThrow(
        'push non-existent-id not found',
      );
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('should cancel a push', async () => {
      mockFindOneDocument.mockResolvedValue({ ...TEST_PUSH });
      mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await cancel(TEST_PUSH.id);

      expect(mockFindOneDocument).toHaveBeenCalledWith('pushes', { id: TEST_PUSH.id });
      expect(mockConnect).toHaveBeenCalledWith('pushes');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { id: TEST_PUSH.id },
        {
          $set: expect.objectContaining({
            authorised: false,
            canceled: true,
            rejected: false,
          }),
        },
        { upsert: true },
      );
      expect(result).toEqual({ message: `canceled ${TEST_PUSH.id}` });
    });

    it('should throw error when push not found', async () => {
      mockFindOneDocument.mockResolvedValue(null);

      await expect(cancel('non-existent-id')).rejects.toThrow('push non-existent-id not found');
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });
  });
});
