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
import { Mongoosify } from '@/db/types';
import { Schema } from 'mongoose';
import { z } from 'zod';

export const calValidation = z.object({
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
export type CALValidation = z.infer<typeof calValidation>;

export type CALSchema = Mongoosify<CALValidation>;
// https://github.com/github/choosealicense.com/blob/gh-pages/_data/rules.yml
export const calSchema = new Schema<CALSchema>(
  {
    permissions: {
      commercialUse: Boolean,
      modifications: Boolean,
      distribution: Boolean,
      privateUse: Boolean,
      patentUse: Boolean,
    },
    conditions: {
      includeCopyright: Boolean,
      includeCopyrightSource: Boolean,
      documentChanges: Boolean,
      discloseSource: Boolean,
      networkUseDisclose: Boolean,
      sameLicense: Boolean,
      sameLicenseFile: Boolean,
      sameLicenseLibrary: Boolean,
    },
    limitations: {
      trademarkUse: Boolean,
      liability: Boolean,
      patentUse: Boolean,
      warranty: Boolean,
    },
  },
  { _id: false },
);
