/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Request } from 'express';
import { getAPIAuthMethods } from '../config';
import { assignRoles, validateJwt } from './passport/jwtUtils';
import type { RoleMapping } from '../config/generated/config';

/**
 * tsoa authentication handler called for every route decorated with @Security.
 *
 * Supported security names:
 *   - 'jwt': Bearer-token validation via OIDC JWT or an existing session.
 */
export async function expressAuthentication(
  request: Request,
  securityName: string,
  _scopes?: string[],
): Promise<unknown> {
  if (securityName === 'jwt') {
    // Already authenticated via session (e.g. passport local login)
    if (request.isAuthenticated && request.isAuthenticated()) {
      return request.user;
    }

    const apiAuthMethods = getAPIAuthMethods();
    const jwtAuthMethod = apiAuthMethods.find((m) => m.type.toLowerCase() === 'jwt');

    if (!jwtAuthMethod || !jwtAuthMethod.enabled) {
      // JWT not configured — pass through (other middleware may enforce auth)
      return;
    }

    const token = request.header('Authorization');
    if (!token) {
      throw Object.assign(new Error('No token provided'), { status: 401 });
    }

    if (!jwtAuthMethod.jwtConfig) {
      console.log('JWT configuration is missing');
      throw Object.assign(new Error('JWT configuration is missing'), { status: 500 });
    }

    const { clientID, authorityURL, expectedAudience, roleMapping } = jwtAuthMethod.jwtConfig;

    if (!authorityURL) {
      console.log('OIDC authority URL is not configured');
      throw Object.assign(new Error('OIDC authority URL is not configured'), { status: 500 });
    }

    if (!clientID) {
      console.log('OIDC client ID is not configured');
      throw Object.assign(new Error('OIDC client ID is not configured'), { status: 500 });
    }

    const audience = expectedAudience || clientID;
    const tokenParts = token.split(' ');
    const accessToken = tokenParts.length === 2 ? tokenParts[1] : tokenParts[0];

    const { verifiedPayload, error } = await validateJwt(
      accessToken,
      authorityURL,
      audience,
      clientID,
    );

    if (error || !verifiedPayload) {
      console.log('JWT validation failed');
      throw Object.assign(new Error(error || 'JWT validation failed'), { status: 401 });
    }

    request.user = verifiedPayload;
    assignRoles(roleMapping as RoleMapping, verifiedPayload, request.user);

    console.log('JWT validation successful');
    return verifiedPayload;
  }

  throw Object.assign(new Error(`Unknown security scheme: ${securityName}`), { status: 401 });
}
