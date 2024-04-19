const mongo = require('mongodb');
const config = require('../../config');
const dbConfig = config.getDatabase();
const options = dbConfig.options;
const connectionString = dbConfig.connectionString;
const MongoDBStore = require('connect-mongo');

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
  return new MongoDBStore({
    mongoUrl: connectionString,
    collectionName: 'user_session',
    mongoOptions: options,
  });
};
