/* eslint-disable max-len */
const connect = require('./helper').connect;

exports.findUser = async function(username) {
  const collection = await connect('users');
  return await collection.findOne({username: username});
};

exports.deleteUser = async function(username) {
  const collection = await connect('users');
  return await collection.deleteOne({username: username});
};

exports.createUser = async function(data) {
  const collection = await connect('users');
  const result = await collection.insertOne(data);
  return result;
};

exports.updateUser = async (user) => {
  const options = {upsert: true};
  const collection = await connect('users');
  await collection.updateOne({username: user.username}, {'$set': user}, options);
};
