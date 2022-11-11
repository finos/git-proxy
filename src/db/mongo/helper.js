const mongo = require('mongodb');
const config = require('../../config');
const dbConfig = config.getDatabase();
const options = dbConfig.options;
const connectionString = dbConfig.connectionString;
const mognoSession = require('express-mongodb-session');

let _db;

exports.connect = async (collectionName) => {
  try {
    if (!_db) {
      const client = new mongo.MongoClient(connectionString, options);
      await client.connect();
      _db = await client.db();
    }

    const collection = _db.collection(collectionName);
    return collection;
  } catch (err) {
    throw err;
  }
};

exports.getSessionStore = (session) => {
  const MongoDBStore = mognoSession(session);
  const store = new MongoDBStore({
    uri: connectionString,
    collection: 'user_session',
    connectionOptions: options,
  });

  return store;
};
