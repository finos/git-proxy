const mongo = require('mongodb');
const config = require('../../config');
const dbConfig = config.getDatabase();
const options = dbConfig.options;
const connectionString = dbConfig.connectionString;
let client;
let db;

// use client to work with db
exports.connect = async (collectionName) => {
  try {
    if (!client) {
      console.log(`connection to mongo on ${connectionString}`);
      client = new mongo.MongoClient(connectionString, options);
      await client.connect();
      db = client.db();
    }

    const collection = db.collection(collectionName);
    return collection;
  } catch (err) {
    console.error(err);
  }
};
