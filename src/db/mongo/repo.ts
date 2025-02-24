import { Repo } from "../types";

const connect = require('./helper').connect;
const collectionName = 'repos';

const isBlank = (str: string) => {
  return !str || /^\s*$/.test(str);
};

export const getRepos = async (query = {}) => {
  const collection = await connect(collectionName);
  return collection.find().toArray();
};

export const getRepo = async (name: string) => {
  const collection = await connect(collectionName);
  return collection.findOne({ name: { $eq: name } });
};

export const createRepo = async (repo: Repo) => {
  console.log(`creating new repo ${JSON.stringify(repo)}`);

  if (isBlank(repo.project)) {
    throw new Error('Project name cannot be empty');
  }
  if (isBlank(repo.name)) {
    throw new Error('Repository name cannot be empty');
  }
  if (isBlank(repo.url)) {
    throw new Error('URL cannot be empty');
  }

  repo.users = {
    canPush: [],
    canAuthorise: [],
  };

  const collection = await connect(collectionName);
  await collection.insertOne(repo);
  console.log(`created new repo ${JSON.stringify(repo)}`);
};

export const addUserCanPush = async (name: string, user: string) => {
  name = name.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ name: name }, { $push: { 'users.canPush': user } });
};

export const addUserCanAuthorise = async (name: string, user: string) => {
  name = name.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ name: name }, { $push: { 'users.canAuthorise': user } });
};

export const removeUserCanPush = async (name: string, user: string) => {
  name = name.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ name: name }, { $pull: { 'users.canPush': user } });
};

export const removeUserCanAuthorise = async (name: string, user: string) => {
  name = name.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ name: name }, { $pull: { 'users.canAuthorise': user } });
};

export const deleteRepo = async (name: string) => {
  const collection = await connect(collectionName);
  await collection.deleteMany({ name: name });
};

export const isUserPushAllowed = async (name: string, user: string) => {
  name = name.toLowerCase();
  return new Promise(async (resolve, reject) => {
    const repo = await exports.getRepo(name);
    console.log(repo.users.canPush);
    console.log(repo.users.canAuthorise);

    if (repo.users.canPush.includes(user) || repo.users.canAuthorise.includes(user)) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

export const canUserApproveRejectPushRepo = async (name: string, user: string) => {
  name = name.toLowerCase();
  console.log(`checking if user ${user} can approve/reject for ${name}`);
  return new Promise(async (resolve, reject) => {
    const repo = await exports.getRepo(name);
    if (repo.users.canAuthorise.includes(user)) {
      console.log(`user ${user} can approve/reject to repo ${name}`);
      resolve(true);
    } else {
      console.log(`user ${user} cannot approve/reject to repo ${name}`);
      resolve(false);
    }
  });
};
