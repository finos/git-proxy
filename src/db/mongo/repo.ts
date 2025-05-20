import { Repo } from '../types';

const connect = require('./helper').connect;
const collectionName = 'repos';

export const getRepos = async (query: any = {}) => {
  const collection = await connect(collectionName);
  return collection.find(query).toArray();
};

export const getRepo = async (name: string) => {
  name = name.toLowerCase();
  const collection = await connect(collectionName);
  return collection.findOne({ name: { $eq: name } });
};

export const getRepoByUrl = async (repoUrl: string) => {
  const collection = await connect(collectionName);
  return collection.findOne({ name: { $eq: repoUrl.toLowerCase() } });
};

export const getRepoById = async (_id: string) => {
  const collection = await connect(collectionName);
  return collection.findOne({ _id: { $eq: _id } });
};

export const createRepo = async (repo: Repo) => {
  const collection = await connect(collectionName);
  await collection.insertOne(repo);
  console.log(`created new repo ${JSON.stringify(repo)}`);
};

export const addUserCanPush = async (_id: string, user: string) => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ _id: _id }, { $push: { 'users.canPush': user } });
};

export const addUserCanAuthorise = async (_id: string, user: string) => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ _id: _id }, { $push: { 'users.canAuthorise': user } });
};

export const removeUserCanPush = async (_id: string, user: string) => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ _id: _id }, { $pull: { 'users.canPush': user } });
};

export const removeUserCanAuthorise = async (_id: string, user: string) => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ _id: _id }, { $pull: { 'users.canAuthorise': user } });
};

export const deleteRepo = async (_id: string) => {
  const collection = await connect(collectionName);
  await collection.deleteMany({ _id: _id });
};
