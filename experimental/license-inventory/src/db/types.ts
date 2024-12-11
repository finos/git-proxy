import { Types } from 'mongoose';

export interface Mongoose {
  _id: Types.UUID;
}

export type Mongoosify<T> = Omit<T, 'id'> & Mongoose;
