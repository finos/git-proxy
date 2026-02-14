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

import { assignRoles, validateJwt } from './jwtUtils';
import type { Request, Response, NextFunction } from 'express';
import { getAPIAuthMethods } from '../../config';
import {
  AuthenticationElement,
  JwtConfig,
  RoleMapping,
  AuthenticationElementType,
} from '../../config/generated/config';

export const type = 'jwt';

export const jwtAuthHandler = (overrideConfig: JwtConfig | null = null) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiAuthMethods: AuthenticationElement[] = overrideConfig
      ? [{ type: 'jwt' as AuthenticationElementType, enabled: true, jwtConfig: overrideConfig }]
      : getAPIAuthMethods();

    const jwtAuthMethod = apiAuthMethods.find((method) => method.type.toLowerCase() === type);

    if (!jwtAuthMethod || !jwtAuthMethod.enabled) {
      return next();
    }

    if (req.isAuthenticated && req.isAuthenticated()) {
      return next();
    }

    const token = req.header('Authorization');
    if (!token) {
      res.status(401).send('No token provided\n');
      return;
    }

    if (!jwtAuthMethod.jwtConfig) {
      res.status(500).send({
        message: 'JWT configuration is missing\n',
      });
      console.log('JWT configuration is missing\n');
      return;
    }

    const config = jwtAuthMethod.jwtConfig!;
    const { clientID, authorityURL, expectedAudience, roleMapping } = config;
    const audience = expectedAudience || clientID;

    if (!authorityURL) {
      res.status(500).send({
        message: 'OIDC authority URL is not configured\n',
      });
      console.log('OIDC authority URL is not configured\n');
      return;
    }

    if (!clientID) {
      res.status(500).send({
        message: 'OIDC client ID is not configured\n',
      });
      console.log('OIDC client ID is not configured\n');
      return;
    }

    const tokenParts = token.split(' ');
    const accessToken = tokenParts.length === 2 ? tokenParts[1] : tokenParts[0];

    const { verifiedPayload, error } = await validateJwt(
      accessToken,
      authorityURL,
      audience,
      clientID,
    );

    if (error || !verifiedPayload) {
      res.status(401).send(error || 'JWT validation failed\n');
      console.log('JWT validation failed\n');
      return;
    }

    req.user = verifiedPayload;
    assignRoles(roleMapping as RoleMapping, verifiedPayload, req.user);

    console.log('JWT validation successful\n');
    next();
  };
};
