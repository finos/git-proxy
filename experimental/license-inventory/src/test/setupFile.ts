import { beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';

beforeAll(async () => {
  if (typeof process.env.MONGO_URI === 'string' && process.env.MONGO_URI.startsWith('mongodb')) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('done connecting mongoose');
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});
