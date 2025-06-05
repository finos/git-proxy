import { MongoClient, Db, Collection, Filter, Document, FindOptions } from 'mongodb';
import { getDatabase } from '../../config';
import MongoDBStore from 'connect-mongo';

const dbConfig = getDatabase();
const connectionString = dbConfig.connectionString;
const options = dbConfig.options;

let _db: Db | null = null;

export const connect = async (collectionName: string): Promise<Collection> => {
  if (!_db) {
    if (!connectionString) {
      throw new Error('MongoDB connection string is not provided');
    }

    const client = new MongoClient(connectionString, options);
    await client.connect();
    _db = client.db();
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
  return new MongoDBStore({
    mongoUrl: connectionString,
    collectionName: 'user_session',
    mongoOptions: options,
  });
};
