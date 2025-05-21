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
