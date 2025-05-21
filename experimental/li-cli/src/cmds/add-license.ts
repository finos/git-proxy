/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.    
 */
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

// TODO: add multiple licenses at the same time
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
