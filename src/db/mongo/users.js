/* eslint-disable max-len */
const logger = require('/src/logs/logger');
const connect = require('./helper').connect;
const usersCollection = 'users';

exports.findUser = async function (username) {
  const collection = await connect(usersCollection);
  return await collection.findOne({ username: username });
};

exports.getUsers = async function (query) {
  const collection = await connect(usersCollection);
  return await collection.find().toArray();
};

exports.deleteUser = async function (username) {
  const collection = await connect(usersCollection);
  return await collection.deleteOne({ username: username });
};

exports.createUser = async function (data) {
  logger.info(JSON.stringify(data));
  const collection = await connect(usersCollection);
  const result = await collection.insertOne(data);
  return result;
};

exports.updateUser = async (user) => {
  const options = { upsert: true };
  const collection = await connect(usersCollection);
  await collection.updateOne(
    { username: user.username },
    { $set: user },
    options,
  );
};
