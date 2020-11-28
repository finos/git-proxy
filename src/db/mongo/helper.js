const mongo = require('mongodb');
const config = require('../../config');
const dbConfig = config.getDatabase();
const options = dbConfig.options;
const connectionString = dbConfig.connectionString;
// let client;
// let db;

// use client to work with db
exports.connect = async (collectionName) => {
  try {
    const client = new mongo.MongoClient(connectionString, options);
    await client.connect();
    const db = await client.db();

    const collection = db.collection(collectionName);
    return collection;
  } catch (err) {
    throw err;
  }
};
