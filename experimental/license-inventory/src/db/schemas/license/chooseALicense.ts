import { Mongoosify } from '@/db/types';
import { Schema } from 'mongoose';
import { z } from 'zod';

export const calValidation = z.object({
  permissions: z
    .object({
      commercialUse: z.boolean().optional(),
      modifications: z.boolean().optional(),
      distribution: z.boolean().optional(),
      privateUse: z.boolean().optional(),
      patentUse: z.boolean().optional(),
    })
    .optional(),
  conditions: z
    .object({
      includeCopyright: z.boolean().optional(),
      includeCopyrightSource: z.boolean().optional(),
      documentChanges: z.boolean().optional(),
      discloseSource: z.boolean().optional(),
      networkUseDisclose: z.boolean().optional(),
      sameLicense: z.boolean().optional(),
      sameLicenseFile: z.boolean().optional(),
      sameLicenseLibrary: z.boolean().optional(),
    })
    .optional(),
  limitations: z
    .object({
      trademarkUse: z.boolean().optional(),
      liability: z.boolean().optional(),
      patentUse: z.boolean().optional(),
      warranty: z.boolean().optional(),
    })
    .optional(),
});
export type CALValidation = z.infer<typeof calValidation>;

export type CALSchema = Mongoosify<CALValidation>;
// https://github.com/github/choosealicense.com/blob/gh-pages/_data/rules.yml
export const calSchema = new Schema<CALSchema>(
  {
    permissions: {
      commercialUse: Boolean,
      modifications: Boolean,
      distribution: Boolean,
      privateUse: Boolean,
      patentUse: Boolean,
    },
    conditions: {
      includeCopyright: Boolean,
      includeCopyrightSource: Boolean,
      documentChanges: Boolean,
      discloseSource: Boolean,
      networkUseDisclose: Boolean,
      sameLicense: Boolean,
      sameLicenseFile: Boolean,
      sameLicenseLibrary: Boolean,
    },
    limitations: {
      trademarkUse: Boolean,
      liability: Boolean,
      patentUse: Boolean,
      warranty: Boolean,
    },
  },
  { _id: false },
);
