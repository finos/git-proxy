/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

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
