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

export const licenseNoID = license.omit({ id: true });
export type LicenseNoID = z.infer<typeof licenseNoID>;

export const licenseNoIDPartial = licenseNoID.partial();
export type LicenseNoIDPartial = z.infer<typeof licenseNoIDPartial>;
