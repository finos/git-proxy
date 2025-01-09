import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { config } from './utils/config';

declare global {
  // eslint-disable-next-line no-var
  var __MONGOINSTANCE: MongoMemoryServer | undefined;
}

export default async function globalTeardown() {
  if (config.Memory) {
    // Config to decide if an mongodb-memory-server instance should be used
    if (!(global.__MONGOINSTANCE instanceof MongoMemoryServer)) {
      throw new Error('expect MongoMemoryServer');
    }
    const instance: MongoMemoryServer = global.__MONGOINSTANCE;
    await instance.stop();
  }
}
