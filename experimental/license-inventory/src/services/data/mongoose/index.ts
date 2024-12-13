import { LicenseDataService } from '../';
import { Database } from '@/db';
import { v4 as uuidv4 } from 'uuid';
import { type LicenseCreateUpdate } from '../license';
import { trace } from '@opentelemetry/api';
import { logger } from '@/logger';

export class MongoLicenseDataService implements LicenseDataService {
  db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async create(licenseData: LicenseCreateUpdate) {
    try {
      if (licenseData.spdxID) {
        const spdxMatch = await this.db.License.findOne({ spdxID: licenseData.spdxID })
          .lean()
          .exec();
        // already exists
        if (spdxMatch !== null) {
          return { error: new Error('license exists'), data: null };
        }
      }
      const _id = uuidv4();
      await this.db.License.create({
        _id,
        ...licenseData,
      });
      return { error: null, data: null };
    } catch (err: unknown) {
      return { error: new Error("couldn't register", { cause: err }), data: null };
    }
  }

  async getByUUID(id: string) {
    try {
      const data = await (await this.db.License.findOne({ _id: id }).exec()).toJSON();
      return { error: null, data };
    } catch (err: unknown) {
      return { error: new Error("couldn't find", { cause: err }), data: null };
    }
  }

  async patchByUUID(id: string, details: LicenseCreateUpdate) {
    try {
      await this.db.License.findOneAndUpdate({ _id: id }, details);
      return { error: null, data: null };
    } catch (err: unknown) {
      return { error: new Error("couldn't find and update", { cause: err }), data: null };
    }
  }

  async deleteByUUID(id: string) {
    try {
      await this.db.License.deleteOne({ _id: id }).exec();
      return { error: null, data: null };
    } catch (err: unknown) {
      return { error: new Error("couldn't delete", { cause: err }), data: null };
    }
  }

  // TODO: consider pagination
  async list() {
    const tracer = trace.getTracer('licenses-list');
    // TODO: pagination
    const results = await this.db.License.find().exec();
    const jsonifyResultsSpan = tracer.startSpan('jsonify-results');
    const jsonResults = await Promise.allSettled(results.map(async (doc) => doc.toJSON()));
    const jsonOutput = jsonResults
      .filter(<T>(r: PromiseSettledResult<T>): r is PromiseFulfilledResult<T> => {
        if (r.status === 'rejected') {
          logger.warn('failed to convert an object', r.reason);
          return false;
        }
        return true;
      })
      .map((r) => r.value);
    jsonifyResultsSpan.end();

    return { error: null, data: jsonOutput };
  }
}
