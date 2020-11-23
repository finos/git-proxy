const connect = require('./helper').connect;

exports.findUser = async function(username, logger=console) {
  const collection = await connect('users');
  return await collection.findOne({username: username});
};

exports.createUser = async function(username, password, logger=console) {
  const data = {
    username: username,
    password: password,
  };

  console.log(`data.mongo:createUser(${username})`);

  const collection = await connect('users');
  const result = await collection.insertOne(data);
  return result;
};
