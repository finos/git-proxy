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
