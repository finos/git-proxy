import { MongoClient, Db, Collection, Filter, Document, FindOptions } from 'mongodb';
import { getDatabase } from '../../config';
import MongoDBStore from 'connect-mongo';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

let _db: Db | null = null;
let _client: MongoClient | null = null;

export const resetConnection = async (): Promise<void> => {
  if (_client) {
    await _client.close();
    _client = null;
    _db = null;
  }
};

export const getDb = (): Db | null => _db;

export const connect = async (collectionName: string): Promise<Collection> => {
  //retrieve config at point of use (rather than import)
  const dbConfig = getDatabase();
  const connectionString = dbConfig.connectionString;
  const options = dbConfig.options;

  if (!_db) {
    if (!connectionString) {
      throw new Error('MongoDB connection string is not provided');
    }

    if (options?.authMechanismProperties?.AWS_CREDENTIAL_PROVIDER) {
      // we break from the config types here as we're providing a function to the mongoDB client
      (options.authMechanismProperties.AWS_CREDENTIAL_PROVIDER as any) = fromNodeProviderChain();
    }

    _client = new MongoClient(connectionString, options);
    await _client.connect();
    _db = _client.db();
  }

  return _db.collection(collectionName);
};

export const findDocuments = async <T>(
  collectionName: string,
  filter: Filter<Document> = {},
  options: FindOptions<Document> = {},
): Promise<T[]> => {
  const collection = await connect(collectionName);
  return collection.find(filter, options).toArray() as Promise<T[]>;
};

export const findOneDocument = async <T>(
  collectionName: string,
  filter: Filter<Document> = {},
  options: FindOptions<Document> = {},
): Promise<T | null> => {
  const collection = await connect(collectionName);
  return (await collection.findOne(filter, options)) as T | null;
};

export const getSessionStore = () => {
  //retrieve config at point of use (rather than import)
  const dbConfig = getDatabase();
  const connectionString = dbConfig.connectionString;
  const options = dbConfig.options;
  return new MongoDBStore({
    mongoUrl: connectionString,
    collectionName: 'user_session',
    mongoOptions: options,
  });
};
