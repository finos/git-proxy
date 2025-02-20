import z from 'zod';

const license = z.object({
  detailsUrl: z.string().url(),
  name: z.string(),
  licenseId: z.string(),
});

export type License = z.infer<typeof license>;
export type LicensesMap = Map<string, License>;

const licenses = z.object({
  licenseListVersion: z.string(),
  licenses: license.array(),
});

export const getLicenseList = async () => {
  // https://spdx.org/licenses/licenses.json
  const req = await fetch('https://spdx.org/licenses/licenses.json');
  const data = await req.json();
  const { data: parsed, error } = licenses.safeParse(data);
  if (error) {
    throw new Error("couldn't get license list", { cause: error });
  }

  const licenseMap = new Map<string, License>();
  parsed.licenses.forEach((license) => {
    licenseMap.set(license.licenseId.toLowerCase(), license);
  });

  return licenseMap;
};

export const getLicenseData = async (url: string) => {
  // https://spdx.org/licenses/licenses.json
  const req = await fetch(url);
  const data = await req.json();
  const { data: parsed, error } = licenses.safeParse(data);
  if (error) {
    throw new Error("couldn't get license list", { cause: error });
  }

  const licenseMap = new Map<string, License>();
  parsed.licenses.forEach((license) => {
    licenseMap.set(license.licenseId, license);
  });

  return licenseMap;
};
