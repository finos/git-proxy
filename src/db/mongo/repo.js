const { logger } = require('/src/logging/index');
const connect = require('./helper').connect;
const cnName = 'repos';

const isBlank = (str) => {
  return !str || /^\s*$/.test(str);
};

exports.getRepos = async (query = {}) => {
  const collection = await connect(cnName);
  return collection.find().toArray();
};

exports.getRepo = async (name) => {
  const collection = await connect(cnName);
  return collection.findOne({ name: { $eq: name } });
};

exports.createRepo = async (repo) => {
  logger.info(`creating new repo ${JSON.stringify(repo)}`);

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

  const collection = await connect(cnName);
  await collection.insertOne(repo);
  logger.info(`created new repo ${JSON.stringify(repo)}`);
};

exports.addUserCanPush = async (name, user) => {
  name = name.toLowerCase();
  const collection = await connect(cnName);
  await collection.updateOne({ name: name }, { $push: { 'users.canPush': user } });
};

exports.addUserCanAuthorise = async (name, user) => {
  name = name.toLowerCase();
  const collection = await connect(cnName);
  await collection.updateOne({ name: name }, { $push: { 'users.canAuthorise': user } });
};

exports.removeUserCanPush = async (name, user) => {
  name = name.toLowerCase();
  const collection = await connect(cnName);
  await collection.updateOne({ name: name }, { $pull: { 'users.canPush': user } });
};

exports.removeUserCanAuthorise = async (name, user) => {
  name = name.toLowerCase();
  const collection = await connect(cnName);
  await collection.updateOne({ name: name }, { $pull: { 'users.canAuthorise': user } });
};

exports.deleteRepo = async (name) => {
  const collection = await connect(cnName);
  await collection.deleteMany({ name: name });
};

exports.isUserPushAllowed = async (name, user) => {
  name = name.toLowerCase();
  return new Promise(async (resolve, reject) => {
    const repo = await exports.getRepo(name);
    logger.info(repo.users.canPush);
    logger.info(repo.users.canAuthorise);

    if (repo.users.canPush.includes(user) || repo.users.canAuthorise.includes(user)) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

exports.canUserApproveRejectPushRepo = async (name, user) => {
  name = name.toLowerCase();
  logger.info(`checking if user ${user} can approve/reject for ${name}`);
  return new Promise(async (resolve, reject) => {
    const repo = await exports.getRepo(name);
    if (repo.users.canAuthorise.includes(user)) {
      logger.info(`user ${user} can approve/reject to repo ${name}`);
      resolve(true);
    } else {
      logger.info(`user ${user} cannot approve/reject to repo ${name}`);
      resolve(false);
    }
  });
};
