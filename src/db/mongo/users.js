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
  data.username = data.username.toLowerCase();
  const collection = await connect(usersCollection);
  const result = await collection.insertOne(data);
  return result;
};

exports.updateUser = async (user) => {
  console.log(`db.mongo.users: updating user, details->${JSON.stringify(user)}`);
  user.username = user.username.toLowerCase();
  const options = {upsert: true};
  const collection = await connect(usersCollection);
  await collection.updateOne({username: user.username}, {'$set': user}, options);
};
