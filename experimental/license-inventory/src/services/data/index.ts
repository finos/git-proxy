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
import type { AsyncResult } from '@/types';
import type { License, LicenseNoID, LicenseNoIDPartial } from './license';

export interface LicenseDataService {
  create: (licenseData: LicenseNoID) => AsyncResult<License>;

  getByUUID: (id: string) => AsyncResult<License | null>;

  patchByUUID: (id: string, licenseData: LicenseNoIDPartial) => AsyncResult<License>;

  deleteByUUID: (id: string) => AsyncResult<null>;

  // TODO: consider pagination
  list: () => AsyncResult<License[]>;
}

export interface DataService {
  licenses: LicenseDataService;
}
