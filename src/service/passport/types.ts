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

import { JwtPayload } from 'jsonwebtoken';

export type JwkKey = {
  kty: string;
  kid: string;
  use: string;
  n?: string;
  e?: string;
  x5c?: string[];
  [key: string]: any;
};

export type JwksResponse = {
  keys: JwkKey[];
};

export type JwtValidationResult = {
  verifiedPayload: JwtPayload | null;
  error: string | null;
};

export type ADProfile = {
  id?: string;
  username?: string;
  email?: string;
  displayName?: string;
  admin?: boolean;
  _json: ADProfileJson;
};

export type ADProfileJson = {
  sAMAccountName?: string;
  mail?: string;
  title?: string;
  userPrincipalName?: string;
  [key: string]: any;
};

export type ADVerifyCallback = (err: Error | null, user: ADProfile | null) => void;
