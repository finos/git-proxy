import { OptionalId, Document, ObjectId } from 'mongodb';
import { toClass } from '../helper';
import { User } from '../types';
import { connect } from './helper';
import _ from 'lodash';
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

export const getUsers = async function (query: any = {}): Promise<User[]> {
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

export const updateUser = async (user: User): Promise<void> => {
  user.username = user.username.toLowerCase();
  if (user.email) {
    user.email = user.email.toLowerCase();
  }
  if (!user.publicKeys) {
    user.publicKeys = [];
  }
  const { _id, ...userWithoutId } = user;
  const filter = _id ? { _id: new ObjectId(_id) } : { username: user.username };
  const options = { upsert: true };
  const collection = await connect(collectionName);
  await collection.updateOne(filter, { $set: userWithoutId }, options);
};

export const addPublicKey = async (username: string, publicKey: string): Promise<void> => {
  const collection = await connect(collectionName);
  await collection.updateOne(
    { username: username.toLowerCase() },
    { $addToSet: { publicKeys: publicKey } },
  );
};

export const removePublicKey = async (username: string, publicKey: string): Promise<void> => {
  const collection = await connect(collectionName);
  await collection.updateOne(
    { username: username.toLowerCase() },
    { $pull: { publicKeys: publicKey } },
  );
};

export const findUserBySSHKey = async function (sshKey: string): Promise<User | null> {
  const collection = await connect(collectionName);
  const doc = await collection.findOne({ publicKeys: { $eq: sshKey } });
  return doc ? toClass(doc, User.prototype) : null;
};
