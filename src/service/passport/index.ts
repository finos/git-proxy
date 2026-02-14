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

import passport, { type PassportStatic } from 'passport';
import * as local from './local';
import * as activeDirectory from './activeDirectory';
import * as oidc from './oidc';
import * as config from '../../config';
import { AuthenticationElement } from '../../config/generated/config';

type StrategyModule = {
  configure: (passport: PassportStatic) => Promise<PassportStatic>;
  createDefaultAdmin?: () => Promise<void>;
  type: string;
};

export const authStrategies: Record<string, StrategyModule> = {
  local,
  activedirectory: activeDirectory,
  openidconnect: oidc,
};

export const configure = async (): Promise<PassportStatic> => {
  passport.initialize();

  const authMethods: AuthenticationElement[] = config.getAuthMethods();

  for (const auth of authMethods) {
    const strategy = authStrategies[auth.type.toLowerCase()];
    if (strategy && typeof strategy.configure === 'function') {
      await strategy.configure(passport);
    }
  }

  if (authMethods.some((auth) => auth.type.toLowerCase() === 'local')) {
    await local.createDefaultAdmin?.();
  }

  return passport;
};

export const getPassport = (): PassportStatic => passport;
