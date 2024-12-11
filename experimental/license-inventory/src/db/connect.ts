import { AsyncResult } from '@/types';
import mongoose from 'mongoose';

export const connectDB = async (dbURI: string): AsyncResult<void> => {
  try {
    await mongoose.connect(dbURI);
    return { error: null, data: null };
  } catch (e: unknown) {
    if (e instanceof Error) {
      return { error: e, data: null };
    }
    return { error: new Error('unknown error occured'), data: null };
  }
};
