import { z } from 'zod';

export type CalInfo = {
  permissions?: {
    commercialUse?: boolean;
    modifications?: boolean;
    distribution?: boolean;
    privateUse?: boolean;
    patentUse?: boolean;
  };
  conditions?: {
    includeCopyright?: boolean;
    includeCopyrightSource?: boolean;
    documentChanges?: boolean;
    discloseSource?: boolean;
    networkUseDisclose?: boolean;
    sameLicense?: boolean;
    sameLicenseFile?: boolean;
    sameLicenseLibrary?: boolean;
  };
  limitations?: {
    trademarkUse?: boolean;
    liability?: boolean;
    patentUse?: boolean;
    warranty?: boolean;
  };
};

export type InventoryLicense = {
  name: string;
  spdxID?: string;
  chooseALicenseInfo?: CalInfo;
};

const pushLicenseSchema = z.object({
  id: z.string().uuid(),
});

export async function pushLicense(liURL: string, data: InventoryLicense): Promise<string> {
  const path = '/api/v0/licenses/';
  const res = await fetch(liURL + path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const resObj = await res.json();
  const { data: resData, error } = pushLicenseSchema.safeParse(resObj);
  // TODO: account for already exists
  if (error) {
    throw new Error("couldn't process data", { cause: error });
  }
  return resData.id;
}
