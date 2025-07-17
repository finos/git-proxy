import z from 'zod';
import localSPDX from './licenses.json';

const licenseSchema = z.object({
  isDeprecatedLicenseId: z.boolean(),
  detailsUrl: z.string().url(),
  name: z.string(),
  licenseId: z.string(),
});

export type License = z.infer<typeof licenseSchema>;
export type LicensesMap = Map<string, License>;

const licensesSchema = z.object({
  licenseListVersion: z.string(),
  licenses: licenseSchema.array(),
});
export type Licenses = z.infer<typeof licensesSchema>;

export const getLicenseList = async (allowDeprecated: boolean) => {
  let licenses: Licenses | undefined = undefined;
  try {
    // https://spdx.org/licenses/licenses.json
    const req = await fetch('https://spdx.org/licenses/licenses.json');
    const data = await req.json();
    const { data: parsed, error } = licensesSchema.safeParse(data);
    if (error) {
      throw new Error("couldn't get license list", { cause: error });
    }
    licenses = parsed;
  } catch (e: unknown) {
    console.warn('failed to fetch upstream licenses, falling back to offline copy');
    licenses = localSPDX;
  }

  const licenseMap: LicensesMap = new Map<string, License>();
  (licenses ?? ({} as Licenses)).licenses.forEach((license) => {
    if (!allowDeprecated && license.isDeprecatedLicenseId) {
      return;
    }
    licenseMap.set(license.licenseId.toLowerCase(), license);
  });

  return licenseMap;
};
