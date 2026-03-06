import { beforeAll, afterAll, afterEach } from 'vitest';
import { MongoClient } from 'mongodb';
import { resetConnection } from '../src/db/mongo/helper';
import { invalidateCache } from '../src/config';

const DEFAULT_TEST_DB_NAME = 'git-proxy-test';
const COLLECTIONS = ['repos', 'users', 'pushes', 'user_session'];

let client: MongoClient | null = null;

const getTestDbName = (connectionString: string): string => {
  try {
    const url = new URL(connectionString);
    const dbName = url.pathname.replace(/^\//, '');
    return dbName || DEFAULT_TEST_DB_NAME;
  } catch {
    return DEFAULT_TEST_DB_NAME;
  }
};

beforeAll(async () => {
  const connectionString =
    process.env.GIT_PROXY_MONGO_CONNECTION_STRING ||
    `mongodb://localhost:27017/${DEFAULT_TEST_DB_NAME}`;
  const testDbName = getTestDbName(connectionString);

  const shouldConnect = process.env.RUN_MONGO_TESTS === 'true';

  if (shouldConnect) {
    try {
      client = new MongoClient(connectionString, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      await client.connect();
      console.log(`MongoDB connection established for integration tests (${testDbName})`);
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }
});

afterEach(async () => {
  if (client) {
    const dbName = getTestDbName(
      process.env.GIT_PROXY_MONGO_CONNECTION_STRING ||
        `mongodb://localhost:27017/${DEFAULT_TEST_DB_NAME}`,
    );
    const db = client.db(dbName);
    for (const collection of COLLECTIONS) {
      try {
        await db.collection(collection).deleteMany({});
      } catch (error) {
        console.warn(
          `Failed to clear collection "${collection}" during integration test cleanup`,
          error,
        );
      }
    }
  }

  try {
    await resetConnection();
  } catch (error) {
    console.warn('Failed to reset MongoDB connection during integration test cleanup', error);
  }
  invalidateCache();
});

afterAll(async () => {
  try {
    await resetConnection();
  } catch (error) {
    console.warn('Failed to reset MongoDB connection during integration test cleanup', error);
  }

  if (client) {
    try {
      const dbName = getTestDbName(
        process.env.GIT_PROXY_MONGO_CONNECTION_STRING ||
          `mongodb://localhost:27017/${DEFAULT_TEST_DB_NAME}`,
      );
      await client.db(dbName).dropDatabase();
    } catch (error) {
      console.warn('Failed to drop MongoDB test database during cleanup', error);
    }
    await client.close();
    client = null;
  }

  console.log('MongoDB integration test cleanup complete');
});
