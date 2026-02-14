/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
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
