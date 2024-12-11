import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { config } from './utils/config';

export default async function globalTeardown() {
  if (config.Memory) {
    // Config to decide if an mongodb-memory-server instance should be used
    const instance: MongoMemoryServer = global.__MONGOINSTANCE;
    await instance.stop();
  }
}
