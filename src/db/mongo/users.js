/* eslint-disable max-len */
const connect = require('./helper').connect;
const usersCollection = 'users';

exports.findUser = async function(username) {
  const collection = await connect(usersCollection);
  return await collection.findOne({username: username});
};

exports.getUsers = async function(query) {
  console.log(`Getting users for query= ${JSON.stringify(query)}`);
  const collection = await connect(usersCollection);
  return await collection.find(query).toArray();
};

exports.deleteUser = async function(username) {
  const collection = await connect(usersCollection);
  return await collection.deleteOne({username: username});
};

exports.createUser = async function(data) {
  const collection = await connect(usersCollection);
  const result = await collection.insertOne(data);
  return result;
};

exports.updateUser = async (user) => {
  console.log(`updating user ${user.username}`);
  const options = {upsert: true};
  const collection = await connect(usersCollection);
  await collection.updateOne({username: user.username}, {'$set': user}, options);
};
