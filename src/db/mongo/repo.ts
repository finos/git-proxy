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

export const createRepo = async (repo: Repo) => {
  const collection = await connect(collectionName);
  await collection.insertOne(repo);
  console.log(`created new repo ${JSON.stringify(repo)}`);
};

export const addUserCanPush = async (repoUrl: string, user: string) => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ url: repoUrl }, { $push: { 'users.canPush': user } });
};

export const addUserCanAuthorise = async (repoUrl: string, user: string) => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ url: repoUrl }, { $push: { 'users.canAuthorise': user } });
};

export const removeUserCanPush = async (repoUrl: string, user: string) => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ url: repoUrl }, { $pull: { 'users.canPush': user } });
};

export const removeUserCanAuthorise = async (repoUrl: string, user: string) => {
  user = user.toLowerCase();
  const collection = await connect(collectionName);
  await collection.updateOne({ url: repoUrl }, { $pull: { 'users.canAuthorise': user } });
};

export const deleteRepo = async (repoUrl: string) => {
  const collection = await connect(collectionName);
  await collection.deleteMany({ url: repoUrl });
};

export const isUserPushAllowed = async (repoUrl: string, user: string) => {
  user = user.toLowerCase();
  return new Promise(async (resolve) => {
    const repo = await exports.getRepoByUrl(repoUrl);
    console.log(repo.users.canPush);
    console.log(repo.users.canAuthorise);

    if (repo.users.canPush.includes(user) || repo.users.canAuthorise.includes(user)) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

export const canUserApproveRejectPushRepo = async (repoUrl: string, user: string) => {
  user = user.toLowerCase();
  console.log(`checking if user ${user} can approve/reject for ${repoUrl}`);
  return new Promise(async (resolve) => {
    const repo = await exports.getRepoByUrl(repoUrl);
    if (repo.users.canAuthorise.includes(user)) {
      console.log(`user ${user} can approve/reject to repo ${repoUrl}`);
      resolve(true);
    } else {
      console.log(`user ${user} cannot approve/reject to repo ${repoUrl}`);
      resolve(false);
    }
  });
};
