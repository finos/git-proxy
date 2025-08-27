import _ from 'lodash';
import { Repo } from '../types';
import { connect } from './helper';
import { toClass } from '../helper';
import { ObjectId, OptionalId, Document } from 'mongodb';
const collectionName = 'repos';

export const getRepos = async (query: any = {}): Promise<Repo[]> => {
  const collection = await connect(collectionName);
  const docs = collection.find(query).toArray();
  return _.chain(docs)
    .map((x) => toClass(x, Repo.prototype))
    .value();
};

export const getRepo = async (name: string): Promise<Repo | null> => {
  name = name.toLowerCase();
  const collection = await connect(collectionName);
  const doc = await collection.findOne({ name: { $eq: name } });
  return doc ? toClass(doc, Repo.prototype) : null;
};

export const getRepoByUrl = async (repoUrl: string): Promise<Repo | null> => {
  const collection = await connect(collectionName);
  const doc = await collection.findOne({ url: { $eq: repoUrl.toLowerCase() } });
  return doc ? toClass(doc, Repo.prototype) : null;
};

export const getRepoById = async (_id: string): Promise<Repo | null> => {
  const collection = await connect(collectionName);
  const doc = await collection.findOne({ _id: new ObjectId(_id) });
  return doc ? toClass(doc, Repo.prototype) : null;
};

export const createRepo = async (repo: Repo): Promise<Repo> => {
  const collection = await connect(collectionName);
  const response = await collection.insertOne(repo as OptionalId<Document>);
  console.log(`created new repo ${JSON.stringify(repo)}`);
  // add in the _id generated for the record
  repo._id = response.insertedId.toString();
  return repo;
};

export const addUserCanPush = async (_id: string, user: string): Promise<void> => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ _id: new ObjectId(_id) }, { $push: { 'users.canPush': user } });
};

export const addUserCanAuthorise = async (_id: string, user: string): Promise<void> => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ _id: new ObjectId(_id) }, { $push: { 'users.canAuthorise': user } });
};

export const removeUserCanPush = async (_id: string, user: string): Promise<void> => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ _id: new ObjectId(_id) }, { $pull: { 'users.canPush': user } });
};

export const removeUserCanAuthorise = async (_id: string, user: string): Promise<void> => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ _id: new ObjectId(_id) }, { $pull: { 'users.canAuthorise': user } });
};

export const deleteRepo = async (_id: string): Promise<void> => {
  const collection = await connect(collectionName);
  await collection.deleteMany({ _id: new ObjectId(_id) });
};
