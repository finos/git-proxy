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
import { MongoClient } from 'mongodb';

const mockSort = vi.fn();
const mockSkip = vi.fn();
const mockLimit = vi.fn();
const mockToArray = vi.fn();
const mockCountDocuments = vi.fn();

const mockCollection = {
  find: vi.fn(),
  findOne: vi.fn(),
  countDocuments: mockCountDocuments,
};

const mockDb = {
  collection: vi.fn(() => mockCollection),
};

const mockClient = {
  connect: vi.fn().mockResolvedValue(undefined),
  db: vi.fn(() => mockDb),
};

vi.mock('mongodb', async () => {
  const actual = await vi.importActual('mongodb');
  return {
    ...actual,
    MongoClient: vi.fn(() => mockClient),
  };
});

const mockGetDatabase = vi.fn();

vi.mock('../../../src/config', () => ({
  getDatabase: mockGetDatabase,
}));

const mockFromNodeProviderChain = vi.fn();

vi.mock('@aws-sdk/credential-providers', () => ({
  fromNodeProviderChain: mockFromNodeProviderChain,
}));

const mockMongoDBStore = vi.fn();

vi.mock('connect-mongo', () => ({
  default: mockMongoDBStore,
}));

describe('MongoDB Helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSort.mockReturnValue({ skip: mockSkip, limit: mockLimit, toArray: mockToArray });
    mockSkip.mockReturnValue({ limit: mockLimit, toArray: mockToArray });
    mockLimit.mockReturnValue({ toArray: mockToArray });
    // Default find returns toArray directly (for findDocuments) and sort chain (for paginatedFind)
    mockCollection.find.mockReturnValue({ toArray: mockToArray, sort: mockSort });

    // Clear cached db
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connect', () => {
    it('should connect to MongoDB and return collection', async () => {
      mockGetDatabase.mockReturnValue({
        connectionString: 'mongodb://localhost:27017/testdb',
        options: {},
      });

      const { connect } = await import('../../../src/db/mongo/helper');

      const result = await connect('testCollection');

      expect(MongoClient).toHaveBeenCalledWith('mongodb://localhost:27017/testdb', {});
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.db).toHaveBeenCalledTimes(1);
      expect(mockDb.collection).toHaveBeenCalledWith('testCollection');
      expect(result).toBe(mockCollection);
    });

    it('should reuse existing connection', async () => {
      mockGetDatabase.mockReturnValue({
        connectionString: 'mongodb://localhost:27017/testdb',
        options: {},
      });

      const { connect } = await import('../../../src/db/mongo/helper');

      const result = await connect('collection1');

      expect(MongoClient).toHaveBeenCalledWith('mongodb://localhost:27017/testdb', {});
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.db).toHaveBeenCalledTimes(1);
      expect(mockDb.collection).toHaveBeenCalledWith('collection1');
      expect(result).toBe(mockCollection);

      // Accessing a different collection should reuse the existing db connection
      await connect('collection2');
      expect(MongoClient).toHaveBeenCalledTimes(1);
      expect(mockClient.connect).toHaveBeenCalledTimes(1);
      expect(mockClient.db).toHaveBeenCalledTimes(1);
      expect(mockDb.collection).toHaveBeenCalledWith('collection2');
    });

    it('should throw error when connection string is not provided', async () => {
      mockGetDatabase.mockReturnValue({
        connectionString: '',
        options: {},
      });

      const { connect } = await import('../../../src/db/mongo/helper');

      await expect(connect('testCollection')).rejects.toThrow(
        'MongoDB connection string is not provided',
      );
    });

    it('should throw error when connection string is undefined', async () => {
      mockGetDatabase.mockReturnValue({
        connectionString: undefined,
        options: {},
      });

      const { connect } = await import('../../../src/db/mongo/helper');

      await expect(connect('testCollection')).rejects.toThrow(
        'MongoDB connection string is not provided',
      );
    });

    it('should handle AWS credential provider', async () => {
      const mockCredentialProvider = vi.fn();
      mockFromNodeProviderChain.mockReturnValue(mockCredentialProvider);

      mockGetDatabase.mockReturnValue({
        connectionString: 'mongodb://localhost:27017/testdb',
        options: {
          authMechanismProperties: {
            AWS_CREDENTIAL_PROVIDER: 'placeholder',
          },
        },
      });

      const { connect } = await import('../../../src/db/mongo/helper');

      await connect('testCollection');

      expect(mockFromNodeProviderChain).toHaveBeenCalled();
      expect(MongoClient).toHaveBeenCalledWith(
        'mongodb://localhost:27017/testdb',
        expect.objectContaining({
          authMechanismProperties: {
            AWS_CREDENTIAL_PROVIDER: mockCredentialProvider,
          },
        }),
      );
    });

    it('should pass options to MongoClient', async () => {
      const options = {
        maxPoolSize: 10,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
      };

      mockGetDatabase.mockReturnValue({
        connectionString: 'mongodb://localhost:27017/testdb',
        options,
      });

      const { connect } = await import('../../../src/db/mongo/helper');

      await connect('testCollection');

      expect(MongoClient).toHaveBeenCalledWith('mongodb://localhost:27017/testdb', options);
    });
  });

  describe('findDocuments', () => {
    beforeEach(async () => {
      mockGetDatabase.mockReturnValue({
        connectionString: 'mongodb://localhost:27017/testdb',
        options: {},
      });
    });

    it('should find documents with default filter and options', async () => {
      const mockDocs = [
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' },
      ];
      mockToArray.mockResolvedValue(mockDocs);

      const { findDocuments } = await import('../../../src/db/mongo/helper');

      const result = await findDocuments('testCollection');

      expect(mockDb.collection).toHaveBeenCalledWith('testCollection');
      expect(mockCollection.find).toHaveBeenCalledWith({}, {});
      expect(mockToArray).toHaveBeenCalled();
      expect(result).toEqual(mockDocs);
    });

    it('should find documents with custom filter', async () => {
      const mockDocs = [{ id: 1, name: 'test1' }];
      mockToArray.mockResolvedValue(mockDocs);

      const { findDocuments } = await import('../../../src/db/mongo/helper');

      const filter = { name: 'test1' };
      const result = await findDocuments('testCollection', filter);

      expect(mockCollection.find).toHaveBeenCalledWith(filter, {});
      expect(result).toEqual(mockDocs);
    });

    it('should find documents with custom options', async () => {
      const mockDocs = [{ id: 1, name: 'test1' }];
      mockToArray.mockResolvedValue(mockDocs);

      const { findDocuments } = await import('../../../src/db/mongo/helper');

      const filter = { name: 'test1' };
      const options = { projection: { _id: 0, name: 1 }, limit: 10 };
      const result = await findDocuments('testCollection', filter, options);

      expect(mockCollection.find).toHaveBeenCalledWith(filter, options);
      expect(result).toEqual(mockDocs);
    });

    it('should return empty array when no documents found', async () => {
      mockToArray.mockResolvedValue([]);

      const { findDocuments } = await import('../../../src/db/mongo/helper');

      const result = await findDocuments('testCollection');

      expect(result).toEqual([]);
    });
  });

  describe('findOneDocument', () => {
    beforeEach(async () => {
      mockGetDatabase.mockReturnValue({
        connectionString: 'mongodb://localhost:27017/testdb',
        options: {},
      });
    });

    it('should find one document with default filter and options', async () => {
      const mockDoc = { id: 1, name: 'test1' };
      mockCollection.findOne.mockResolvedValue(mockDoc);

      const { findOneDocument } = await import('../../../src/db/mongo/helper');

      const result = await findOneDocument('testCollection');

      expect(mockDb.collection).toHaveBeenCalledWith('testCollection');
      expect(mockCollection.findOne).toHaveBeenCalledWith({}, {});
      expect(result).toEqual(mockDoc);
    });

    it('should find one document with custom filter', async () => {
      const mockDoc = { id: 1, name: 'test1' };
      mockCollection.findOne.mockResolvedValue(mockDoc);

      const { findOneDocument } = await import('../../../src/db/mongo/helper');

      const filter = { id: 1 };
      const result = await findOneDocument('testCollection', filter);

      expect(mockCollection.findOne).toHaveBeenCalledWith(filter, {});
      expect(result).toEqual(mockDoc);
    });

    it('should find one document with custom options', async () => {
      const mockDoc = { id: 1, name: 'test1' };
      mockCollection.findOne.mockResolvedValue(mockDoc);

      const { findOneDocument } = await import('../../../src/db/mongo/helper');

      const filter = { id: 1 };
      const options = { projection: { _id: 0, name: 1 } };
      const result = await findOneDocument('testCollection', filter, options);

      expect(mockCollection.findOne).toHaveBeenCalledWith(filter, options);
      expect(result).toEqual(mockDoc);
    });

    it('should return null when document not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const { findOneDocument } = await import('../../../src/db/mongo/helper');

      const result = await findOneDocument('testCollection', { id: 999 });

      expect(result).toBeNull();
    });
  });

  describe('paginatedFind', () => {
    beforeEach(async () => {
      mockGetDatabase.mockReturnValue({
        connectionString: 'mongodb://localhost:27017/testdb',
        options: {},
      });
    });

    it('should return data and total', async () => {
      const docs = [{ id: 1 }, { id: 2 }];
      mockCountDocuments.mockResolvedValue(2);
      mockToArray.mockResolvedValue(docs);

      const { connect, paginatedFind } = await import('../../../src/db/mongo/helper');
      const collection = await connect('testCollection');
      const result = await paginatedFind(collection, {}, { name: 1 }, 0, 0);

      expect(result).toEqual({ data: docs, total: 2 });
    });

    it('should apply skip when skip > 0', async () => {
      mockCountDocuments.mockResolvedValue(10);
      mockToArray.mockResolvedValue([]);

      const { connect, paginatedFind } = await import('../../../src/db/mongo/helper');
      const collection = await connect('testCollection');
      await paginatedFind(collection, {}, {}, 5, 0);

      expect(mockSkip).toHaveBeenCalledWith(5);
    });

    it('should apply limit when limit > 0', async () => {
      mockCountDocuments.mockResolvedValue(10);
      mockToArray.mockResolvedValue([]);

      const { connect, paginatedFind } = await import('../../../src/db/mongo/helper');
      const collection = await connect('testCollection');
      await paginatedFind(collection, {}, {}, 0, 10);

      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it('should not apply skip when skip is 0', async () => {
      mockCountDocuments.mockResolvedValue(5);
      mockToArray.mockResolvedValue([]);

      const { connect, paginatedFind } = await import('../../../src/db/mongo/helper');
      const collection = await connect('testCollection');
      await paginatedFind(collection, {}, {}, 0, 0);

      expect(mockSkip).not.toHaveBeenCalled();
    });

    it('should pass projection to find when provided', async () => {
      mockCountDocuments.mockResolvedValue(1);
      mockToArray.mockResolvedValue([{ id: 1 }]);
      const projection = { _id: 0, name: 1 };

      const { connect, paginatedFind } = await import('../../../src/db/mongo/helper');
      const collection = await connect('testCollection');
      await paginatedFind(collection, {}, {}, 0, 0, projection);

      expect(mockCollection.find).toHaveBeenCalledWith({}, { projection });
    });

    it('should not pass projection when not provided', async () => {
      mockCountDocuments.mockResolvedValue(1);
      mockToArray.mockResolvedValue([]);

      const { connect, paginatedFind } = await import('../../../src/db/mongo/helper');
      const collection = await connect('testCollection');
      await paginatedFind(collection, {}, {}, 0, 0);

      expect(mockCollection.find).toHaveBeenCalledWith({}, undefined);
    });
  });

  describe('getSessionStore', () => {
    it('should create MongoDBStore with connection string and options', async () => {
      const connectionString = 'mongodb://localhost:27017/testdb';
      const options = { maxPoolSize: 10 };

      mockGetDatabase.mockReturnValue({
        connectionString,
        options,
      });

      const { getSessionStore } = await import('../../../src/db/mongo/helper');

      const result = getSessionStore();

      expect(result).toBeDefined();
      expect(mockMongoDBStore).toHaveBeenCalledWith({
        mongoUrl: connectionString,
        collectionName: 'user_session',
        mongoOptions: options,
      });
    });
  });
});
