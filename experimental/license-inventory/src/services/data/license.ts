import { z } from 'zod';

export const chooseALicense = z.object({
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
export type ChooseALicense = z.infer<typeof chooseALicense>;

export const license = z.object({
  id: z.string().uuid(),
  name: z.string(),
  spdxID: z.string().optional(),
  chooseALicenseInfo: chooseALicense.optional(),
});
export type License = z.infer<typeof license>;

export const licenseCreateUpdate = license.omit({ id: true });
export type LicenseCreateUpdate = z.infer<typeof licenseCreateUpdate>;
