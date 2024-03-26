const mongo = require('mongodb');
const config = require('../../config');
const dbConfig = config.getDatabase();
const options = dbConfig.options;
const connectionString = dbConfig.connectionString;
const mongoSession = require('express-mongodb-session');

let _db;

exports.connect = async (collectionName) => {
  if (!_db) {
    const client = new mongo.MongoClient(connectionString, options);
    await client.connect();
    _db = await client.db();
  }

  return _db.collection(collectionName);
};

exports.getSessionStore = (session) => {
  const MongoDBStore = mongoSession(session);
  return new MongoDBStore({
    uri: connectionString,
    collection: 'user_session',
    connectionOptions: options,
  });
};
