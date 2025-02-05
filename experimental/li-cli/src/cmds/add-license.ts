import { setTimeout } from 'node:timers/promises';
import { search } from '@inquirer/prompts';
import { getLicenseList, LicensesMap } from '../lib/spdx';
import { CalInfo, InventoryLicense, pushLicense } from '../lib/inventory';
import { getCALData } from '../lib/chooseALicense';

// const answer = await input({ message: 'Enter your name' });

type Option = {
  name: string;
  value: string;
};

type AddLicenseCMDOptions = {
  spdxID?: string;
  requireCal?: boolean;
};

async function promptForSPDXID(licenseList: LicensesMap): Promise<string> {
  const options: Option[] = [];
  licenseList.forEach(({ licenseId }, k) => {
    options.push({ name: licenseId, value: k });
  });
  const selectedLicenseID = await search({
    message: 'Select a license',
    source: async (input, { signal }) => {
      await setTimeout(300);
      if (signal.aborted) return options;
      if (typeof input !== 'string' || input.length < 1) {
        return options;
      }
      // TODO: itterate over itterable rather than convert to array then map
      // TODO: fuzzy match
      return options.filter((o) => o.value.toLowerCase().startsWith(input?.toLowerCase()));
    },
  });
  return selectedLicenseID;
}

async function addLicenseCMD(liURL: string, options?: AddLicenseCMDOptions) {
  console.info('fetching license list from `spdx.org`');
  const licenseList = await getLicenseList();
  console.info('done fetching');

  const selectedLicenseID = options?.spdxID ?? (await promptForSPDXID(licenseList));

  const selectedLicense = licenseList.get(selectedLicenseID);
  if (typeof selectedLicense !== 'object') {
    console.error("license doesn't exist in list fetched from `spdx.org`");
    throw new Error('missing license');
  }

  console.info(`fetching Choose A License info for license \`${selectedLicense.licenseId}\``);

  let chooseALicenseInfo: CalInfo | undefined = undefined;
  try {
    const cal = await getCALData(selectedLicense.licenseId.toLowerCase());
    chooseALicenseInfo = cal;
  } catch (e) {
    console.log('failed to get info from Choose A License');
    if (options?.requireCal) {
      throw new Error('forced the need for CAL data');
    }
  }

  const licenseData: InventoryLicense = {
    name: selectedLicense.name,
    spdxID: selectedLicense.licenseId,
    chooseALicenseInfo,
  };

  let licenseID: string;
  try {
    const id = await pushLicense(liURL, licenseData);
    licenseID = id;
  } catch (e) {
    console.error('failed to submit license data');
    throw new Error('failed to submit');
  }

  console.log(`License \`${selectedLicense.licenseId}\` added to inventory as \`${licenseID}\``);
}

export default addLicenseCMD;
