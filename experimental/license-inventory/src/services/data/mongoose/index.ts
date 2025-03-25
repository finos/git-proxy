import { type LicenseDataService } from '../';
import { type Database } from '@/db';
import { v4 as uuidv4 } from 'uuid';
import type { License, LicenseNoID, LicenseNoIDPartial } from '../license';
import { trace } from '@opentelemetry/api';
import { logger } from '@/logger';

export class MongooseLicenseDataService implements LicenseDataService {
  db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async create(licenseData: LicenseNoID) {
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
      const insertedData = await (
        await this.db.License.create({
          _id,
          ...licenseData,
        })
      ).toJSON();
      const res: License = {
        id: _id,
        ...insertedData,
      };
      return { error: null, data: res };
      // return { error: null, data: null };
    } catch (err: unknown) {
      return { error: new Error("couldn't register", { cause: err }), data: null };
    }
  }

  async getByUUID(id: string) {
    try {
      const dbRes = await this.db.License.findOne({ _id: id }).lean().exec();
      if (dbRes === null) {
        return { error: null, data: dbRes };
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, __v, ...dbData } = dbRes;
      const data: License = {
        id: _id.toJSON(),
        ...dbData,
      };
      return { error: null, data };
    } catch (err: unknown) {
      return { error: new Error("couldn't find", { cause: err }), data: null };
    }
  }

  async patchByUUID(id: string, details: LicenseNoIDPartial) {
    try {
      const dbRes = await this.db.License.findOneAndUpdate({ _id: id }, details, {
        // return new data
        returnOriginal: false,
      })
        .lean()
        .exec();
      if (dbRes === null) {
        return { error: new Error('no matching license'), data: null };
      }
      const data: License = {
        id: dbRes._id.toJSON(),
        name: dbRes.name,
        chooseALicenseInfo: dbRes.chooseALicenseInfo,
      };
      return { error: null, data: data };
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
    const results = await this.db.License.find().lean().exec();
    const jsonifyResultsSpan = tracer.startSpan('jsonify-results');
    const jsonResults = await Promise.allSettled(
      results.map(async (doc) => {
        const data: License = {
          id: doc._id.toJSON(),
          name: doc.name,
          chooseALicenseInfo: doc.chooseALicenseInfo,
        };
        return data;
      }),
    );
    const jsonOutput = jsonResults
      .filter(<T>(r: PromiseSettledResult<T>): r is PromiseFulfilledResult<T> => {
        if (r.status === 'rejected') {
          logger.warn('failed to convert an object');
          logger.warn(r.reason);
          return false;
        }
        return true;
      })
      .map((r) => r.value);
    jsonifyResultsSpan.end();

    return { error: null, data: jsonOutput };
  }
}
