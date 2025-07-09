import { User } from '../types';

const connect = require('./helper').connect;
const collectionName = 'users';

export const findUser = async function (username: string) {
  const collection = await connect(collectionName);
  return collection.findOne({ username: { $eq: username.toLowerCase() } });
};

export const getUsers = async function (query: any = {}) {
  if (query.username) {
    query.username = query.username.toLowerCase();
  }
  if (query.email) {
    query.email = query.email.toLowerCase();
  }
  console.log(`Getting users for query= ${JSON.stringify(query)}`);
  const collection = await connect(collectionName);
  return collection.find(query, { password: 0 }).toArray();
};

export const deleteUser = async function (username: string) {
  const collection = await connect(collectionName);
  return collection.deleteOne({ username: username.toLowerCase() });
};

export const createUser = async function (user: User) {
  if (!user.publicKeys) {
    user.publicKeys = [];
  }
  user.username = user.username.toLowerCase();
  user.email = user.email.toLowerCase();
  const collection = await connect(collectionName);
  return collection.insertOne(user);
};

export const updateUser = async (user: User) => {
  if (!user.publicKeys) {
    user.publicKeys = [];
  }
  user.username = user.username.toLowerCase();
  if (user.email) {
    user.email = user.email.toLowerCase();
  }
  const options = { upsert: true };
  const collection = await connect(collectionName);
  await collection.updateOne({ username: user.username }, { $set: user }, options);
};

export const addPublicKey = async (username: string, publicKey: string) => {
  const collection = await connect(collectionName);
  return collection.updateOne(
    { username: username.toLowerCase() },
    { $addToSet: { publicKeys: publicKey } },
  );
};

export const removePublicKey = async (username: string, publicKey: string) => {
  const collection = await connect(collectionName);
  return collection.updateOne(
    { username: username.toLowerCase() },
    { $pull: { publicKeys: publicKey } },
  );
};

export const findUserBySSHKey = async function (sshKey: string) {
  const collection = await connect(collectionName);
  return collection.findOne({ publicKeys: { $eq: sshKey } });
};

export const getPublicKeys = async function (username: string): Promise<string[]> {
  const user = await findUser(username);
  if (!user) {
    throw new Error('User not found');
  }
  return user.publicKeys || [];
};
