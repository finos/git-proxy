import type { Mongoose, Model } from 'mongoose';
import { licenseSchema, type LicenseSchema } from './schemas/license/license';

export class Database {
  mongoose: Mongoose;
  License: Model<LicenseSchema>;
  constructor(mongoose: Mongoose) {
    this.mongoose = mongoose;
    this.License = mongoose.model<LicenseSchema>('License', licenseSchema);
  }
}
