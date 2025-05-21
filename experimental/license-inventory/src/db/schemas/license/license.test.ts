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
import { describe, expect, it } from '@jest/globals';
import { License } from '@/db/collections';
import { v4 as uuidv4 } from 'uuid';

// these tests require a mongodb instance
const describeDB = process.env.MONGO_URI?.startsWith('mongodb') ? describe : describe.skip;

describeDB('license', () => {
  it('can insert a basic license', async () => {
    const _id = uuidv4();
    await License.create({
      _id,
      name: 'hello',
    });

    const insertedLicense = await License.findOne({ _id: _id });
    expect(insertedLicense).not.toBeNull();
    expect(insertedLicense!.name).toBe('hello');
  });

  it('can insert a complex license', async () => {
    const _id = uuidv4();
    await License.create({
      _id,
      name: 'complex',
      spdxID: 'sample',
      chooseALicenseInfo: {
        permissions: {
          commercialUse: true,
        },
        conditions: {
          networkUseDisclose: false,
        },
      },
    });

    const insertedLicense = await License.findOne({ _id: _id });
    expect(insertedLicense).not.toBeNull();
    expect(insertedLicense!.name).toBe('complex');
    expect(insertedLicense!.chooseALicenseInfo?.permissions?.commercialUse).toBe(true);
  });
});
