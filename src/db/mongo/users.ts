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

import { OptionalId, Document, ObjectId } from 'mongodb';
import { toClass } from '../helper';
import { User, UserQuery, PublicKeyRecord } from '../types';
import { connect } from './helper';
import _ from 'lodash';
import { DuplicateSSHKeyError } from '../../errors/DatabaseErrors';
const collectionName = 'users';

export const findUser = async function (username: string): Promise<User | null> {
  const collection = await connect(collectionName);
  const doc = await collection.findOne({ username: { $eq: username.toLowerCase() } });
  return doc ? toClass(doc, User.prototype) : null;
};

export const findUserByEmail = async function (email: string): Promise<User | null> {
  const collection = await connect(collectionName);
  const doc = await collection.findOne({ email: { $eq: email.toLowerCase() } });
  return doc ? toClass(doc, User.prototype) : null;
};

export const findUserByOIDC = async function (oidcId: string): Promise<User | null> {
  const collection = await connect(collectionName);
  const doc = await collection.findOne({ oidcId: { $eq: oidcId } });
  return doc ? toClass(doc, User.prototype) : null;
};

export const getUsers = async function (query: Partial<UserQuery> = {}): Promise<User[]> {
  if (query.username) {
    query.username = query.username.toLowerCase();
  }
  if (query.email) {
    query.email = query.email.toLowerCase();
  }
  console.log(`Getting users for query = ${JSON.stringify(query)}`);
  const collection = await connect(collectionName);
  const docs = await collection.find(query).project({ password: 0 }).toArray();
  return _.chain(docs)
    .map((x) => toClass(x, User.prototype))
    .value();
};

export const deleteUser = async function (username: string): Promise<void> {
  const collection = await connect(collectionName);
  await collection.deleteOne({ username: username.toLowerCase() });
};

export const createUser = async function (user: User): Promise<void> {
  user.username = user.username.toLowerCase();
  user.email = user.email.toLowerCase();
  if (!user.publicKeys) {
    user.publicKeys = [];
  }
  const collection = await connect(collectionName);
  await collection.insertOne(user as OptionalId<Document>);
};

export const updateUser = async (user: Partial<User>): Promise<void> => {
  if (user.username) {
    user.username = user.username.toLowerCase();
  }
  if (user.email) {
    user.email = user.email.toLowerCase();
  }
  const { _id, ...userWithoutId } = user;
  const filter = _id ? { _id: new ObjectId(_id) } : { username: user.username };
  const options = { upsert: true };
  const collection = await connect(collectionName);
  await collection.updateOne(filter, { $set: userWithoutId }, options);
};

export const addPublicKey = async (username: string, publicKey: PublicKeyRecord): Promise<void> => {
  // Check if this key already exists for any user
  const existingUser = await findUserBySSHKey(publicKey.key);

  if (existingUser && existingUser.username.toLowerCase() !== username.toLowerCase()) {
    throw new DuplicateSSHKeyError(existingUser.username);
  }

  // Key doesn't exist for other users
  const collection = await connect(collectionName);

  const user = await collection.findOne({ username: username.toLowerCase() });
  if (!user) {
    throw new Error('User not found');
  }

  const keyExists = user.publicKeys?.some(
    (k: PublicKeyRecord) =>
      k.key === publicKey.key || (k.fingerprint && k.fingerprint === publicKey.fingerprint),
  );

  if (keyExists) {
    throw new Error('SSH key already exists');
  }

  await collection.updateOne(
    { username: username.toLowerCase() },
    { $push: { publicKeys: publicKey } },
  );
};

export const removePublicKey = async (username: string, fingerprint: string): Promise<void> => {
  const collection = await connect(collectionName);
  await collection.updateOne(
    { username: username.toLowerCase() },
    { $pull: { publicKeys: { fingerprint: fingerprint } } },
  );
};

export const findUserBySSHKey = async function (sshKey: string): Promise<User | null> {
  const collection = await connect(collectionName);
  const doc = await collection.findOne({ 'publicKeys.key': { $eq: sshKey } });
  return doc ? toClass(doc, User.prototype) : null;
};

export const getPublicKeys = async (username: string): Promise<PublicKeyRecord[]> => {
  const user = await findUser(username);
  if (!user) {
    throw new Error('User not found');
  }
  return user.publicKeys || [];
};
