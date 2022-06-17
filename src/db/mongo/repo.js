const connect = require('./helper').connect;
const cnName = 'repos';

exports.getRepos = async (query={}) => {
  const collection = await connect(cnName);
  const result = await collection.find().toArray();
  return result;
};

exports.getRepo = async (name) => {
  const collection = await connect(cnName);
  const result = await collection.findOne({name: name});
  return result;
};

exports.createRepo = async (repo) => {
  repo.users = {
    canPush: [],
    canAuthorise: [],
  };

  const collection = await connect(cnName);
  await collection.insertOne(repo);
};

exports.addUserCanPush = async (name, user) => {
  const collection = await connect(cnName);
  await collection.updateOne(
      {name: name},
      {'$push': {'users.canPush': user}});
};

exports.addUserCanAuthorise = async (name, user) => {
  const collection = await connect(cnName);
  await collection.updateOne(
      {name: name},
      {'$push': {'users.canAuthorise': user}});
};

exports.removeUserCanPush = async (name, user) => {
  const collection = await connect(cnName);
  await collection.updateOne(
      {name: name},
      {'$pull': {'users.canPush': user}});
};

exports.removeUserCanAuthorise = async (name, user) => {
  const collection = await connect(cnName);
  await collection.updateOne(
      {name: name},
      {'$pull': {'users.canAuthorise': user}});
};

exports.deleteRepo = async (name) => {
  const collection = await connect(cnName);
  await collection.deleteMany({name: name});
};

exports.isUserPushAllowed = async (name, user) => {
  return new Promise(async (resolve, reject) => {
    const repo = await exports.getRepo(name);
    console.log(repo.users.canPush);
    console.log(repo.users.canAuthorise);

    if (repo.users.canPush.includes(user) ||
        repo.users.canAuthorise.includes(user)) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

exports.canUserApproveRejectPushRepo = async (name, user) => {
  return new Promise(async (resolve, reject) => {
    const repo = await exports.getRepo(name);
      if (repo.users.canAuthorise.includes(user)) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
};
