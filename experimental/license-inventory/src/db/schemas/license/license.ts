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
import { Schema, model } from 'mongoose';
import { calSchema, calValidation } from './chooseALicense';
import { z } from 'zod';
import { Mongoosify } from '@/db/types';

export const licenseValidation = z.object({
  id: z.string().uuid(),
  name: z.string(),
  spdxID: z.string().optional(),
  chooseALicenseInfo: calValidation.optional(),
});
export type LicenseValidation = z.infer<typeof licenseValidation>;

export type LicenseSchema = Mongoosify<LicenseValidation>;
export const licenseSchema = new Schema<LicenseSchema>(
  {
    _id: { type: Schema.Types.UUID, required: true },
    // pretty name
    name: { type: String, required: true },
    // allow for licenses which don't have an SPDX ID
    spdxID: String,
    chooseALicenseInfo: calSchema,
  },
  {
    // automatic createdAt updatedAt
    timestamps: true,
  },
);

// licenses collection
export const License = model('License', licenseSchema);
