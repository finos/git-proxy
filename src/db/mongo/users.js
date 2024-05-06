const connect = require('./helper').connect;
const { logger } = require('/src/logging/index');

const usersCollection = 'users';

exports.findUser = async function (username) {
  const collection = await connect(usersCollection);
  return collection.findOne({ username: { $eq: username } });
};

exports.getUsers = async function (query) {
  logger.info(`Getting users for query= ${JSON.stringify(query)}`);
  const collection = await connect(usersCollection);
  return collection.find(query).toArray();
};

exports.deleteUser = async function (username) {
  const collection = await connect(usersCollection);
  return collection.deleteOne({ username: username });
};

exports.createUser = async function (data) {
  data.username = data.username.toLowerCase();
  const collection = await connect(usersCollection);
  return collection.insertOne(data);
};

exports.updateUser = async (user) => {
  user.username = user.username.toLowerCase();
  const options = { upsert: true };
  const collection = await connect(usersCollection);
  await collection.updateOne({ username: user.username }, { $set: user }, options);
};
