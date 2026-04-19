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
  const {
    getPushes,
    getPushesForUserProfile,
    getPush,
    deletePush,
    writeAudit,
    authorise,
    reject,
    cancel,
  } = await import('../../../src/db/mongo/pushes');

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
            attestation: 1,
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
            rejection: 1,
            repo: 1,
            repoName: 1,
            timestamp: 1,
            type: 1,
            url: 1,
            userEmail: 1,
          },
          sort: {
            timestamp: -1,
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

  describe('getPushesForUserProfile', () => {
    it('should get pushes for user profile with $or filter', async () => {
      mockFindDocuments.mockResolvedValue([TEST_PUSH]);

      const result = await getPushesForUserProfile(['a@example.com'], 'bob');

      expect(mockFindDocuments).toHaveBeenCalledWith(
        'pushes',
        expect.objectContaining({
          type: 'push',
          $or: expect.arrayContaining([
            { userEmail: { $in: ['a@example.com'] } },
            {
              'attestation.reviewer.username': expect.any(RegExp),
            },
          ]),
        }),
        expect.objectContaining({
          sort: { timestamp: -1 },
        }),
      );
      const filter = mockFindDocuments.mock.calls[0][1] as {
        $or: Array<Record<string, unknown>>;
      };
      const reviewer = filter.$or[1]['attestation.reviewer.username'] as RegExp;
      expect(reviewer.test('Bob')).toBe(true);
      expect(reviewer.test('alice')).toBe(false);
      expect(result).toEqual([TEST_PUSH]);
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

      const rejection = { signature: 'test-sig' };
      const result = await reject(TEST_PUSH.id, rejection);

      expect(mockFindOneDocument).toHaveBeenCalledWith('pushes', { id: TEST_PUSH.id });
      expect(mockConnect).toHaveBeenCalledWith('pushes');
      expect(mockUpdateOne).toHaveBeenCalledWith(
        { id: TEST_PUSH.id },
        {
          $set: expect.objectContaining({
            authorised: false,
            canceled: false,
            rejected: true,
            rejection: rejection,
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
