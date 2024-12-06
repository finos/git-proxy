import { MongoMemoryServer } from 'mongodb-memory-server-core';
import * as mongoose from 'mongoose';
import { config } from './utils/config';

export default async function globalSetup() {
  // TODO: make this logic smarter for no mongo, existing mongo, or using MongoMemoryServer
  if (config.Memory) {
    const instance = await MongoMemoryServer.create();
    const uri = instance.getUri();
    global.__MONGOINSTANCE = instance;
    process.env.MONGO_URI = uri.slice(0, uri.lastIndexOf('/'));

    // The following is to make sure the database is clean before a test suite starts
    const conn = await mongoose.connect(`${process.env.MONGO_URI}/${config.Database}`);
    await conn.connection.db?.dropDatabase();
    await mongoose.disconnect();
  }

  if (typeof process.env.MONGO_URI !== 'string') {
    // pass env validation
    process.env.MONGO_URI = 'dummy';
  }
}
