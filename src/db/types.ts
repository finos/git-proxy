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
export type PushQuery = {
  error: boolean;
  blocked: boolean,
  allowPush: boolean,
  authorised: boolean
};

export type UserRole = 'canPush' | 'canAuthorise';

export type Repo = {
  project: string;
  name: string;
  url: string;
  users: Record<UserRole, string[]>;
  _id: string;
};

export type User = {
  _id: string;
  username: string;
  password: string | null; // null if oidcId is set
  gitAccount: string;
  email: string;
  admin: boolean;
  oidcId: string | null;
};

export type Push = {
  id: string;
  allowPush: boolean;
  authorised: boolean;
  blocked: boolean;
  blockedMessage: string;
  branch: string;
  canceled: boolean;
  commitData: object;
  commitFrom: string;
  commitTo: string;
  error: boolean;
  method: string;
  project: string;
  rejected: boolean;
  repo: string;
  repoName: string;
  timepstamp: string;
  type: string;
  url: string;
};
