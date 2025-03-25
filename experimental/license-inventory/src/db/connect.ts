import { AsyncResult } from '@/types';
import mongoose, { type Mongoose } from 'mongoose';

export const connectDB = async (dbURI: string): AsyncResult<Mongoose> => {
  try {
    const connection = await mongoose.connect(dbURI);
    return { error: null, data: connection };
  } catch (e: unknown) {
    if (e instanceof Error) {
      return { error: e, data: null };
    }
    return { error: new Error('unknown error occured'), data: null };
  }
};
