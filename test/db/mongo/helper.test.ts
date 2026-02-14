import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { MongoClient } from 'mongodb';

const mockCollection = {
  find: vi.fn(),
  findOne: vi.fn(),
};

const mockDb = {
  collection: vi.fn(() => mockCollection),
};

const mockClient = {
  connect: vi.fn().mockResolvedValue(undefined),
  db: vi.fn(() => mockDb),
};

const mockToArray = vi.fn();

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
    mockCollection.find.mockReturnValue({ toArray: mockToArray });

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
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.db).toHaveBeenCalled();
      expect(mockDb.collection).toHaveBeenCalledWith('testCollection');
      expect(result).toBe(mockCollection);
    });

    it('should reuse existing connection', async () => {
      mockGetDatabase.mockReturnValue({
        connectionString: 'mongodb://localhost:27017/testdb',
        options: {},
      });

      const { connect } = await import('../../../src/db/mongo/helper');

      await connect('collection1');

      vi.clearAllMocks();
      mockDb.collection.mockReturnValue(mockCollection);

      await connect('collection2');

      expect(MongoClient).not.toHaveBeenCalled();
      expect(mockClient.connect).not.toHaveBeenCalled();
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
