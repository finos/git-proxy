import { Schema, model } from 'mongoose';
import { calSchema, calValidation } from './chooseALicense';
import { z } from 'zod';
import { Mongoosify } from '@/db/types';

export const licenseValidation = z.object({
  id: z.string().uuid(),
  name: z.string(),
  spdxID: z.string().optional(),
  chooseALicenseInfo: calValidation.optional(),
});
export type LicenseValidation = z.infer<typeof licenseValidation>;

export type LicenseSchema = Mongoosify<LicenseValidation>;
export const licenseSchema = new Schema<LicenseSchema>(
  {
    _id: { type: Schema.Types.UUID, required: true },
    // pretty name
    name: { type: String, required: true },
    // allow for licenses which don't have an SPDX ID
    spdxID: String,
    chooseALicenseInfo: calSchema,
  },
  {
    // automatic createdAt updatedAt
    timestamps: true,
    toObject: {
      virtuals: true,
      versionKey: false,
      transform: (doc, ret) => {
        delete ret._id;
      },
    },
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: (doc, ret) => {
        delete ret._id;
      },
    },
    virtuals: {
      id: {
        get() {
          return this._id.toString();
        },
      },
    },
  },
);

// licenses collection
export const License = model('License', licenseSchema);
