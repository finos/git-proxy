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

import { getAPIAuthMethods } from '../../config';
import { AuthenticationElement, RoleMapping } from '../../config/generated/config';
import { assignRoles, validateJwt } from '../passport/jwtUtils';
import { pub } from './base';
import { mustChangePassword } from './context';
import { messageError, RawResponse, textError, withBody } from './errors';

const JWT_TYPE = 'jwt';

const jwtErrors = {
  JWT_MISCONFIGURED: messageError(500, 'JWT API authentication is misconfigured'),
  JWT_UNAUTHORIZED: textError(401, 'Missing or invalid JWT (only when JWT API auth is enabled)'),
};

/**
 * Authenticates API requests with a bearer JWT when JWT API authentication is
 * enabled and the request has no session.
 */
export const jwtAuth = pub.errors(jwtErrors).middleware(async ({ context, next, errors }) => {
  const apiAuthMethods: AuthenticationElement[] = getAPIAuthMethods();
  const jwtAuthMethod = apiAuthMethods.find((method) => method.type.toLowerCase() === JWT_TYPE);
  const { req } = context;

  if (!jwtAuthMethod || !jwtAuthMethod.enabled) {
    return next();
  }

  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  const token = req.headers.authorization;
  if (!token) {
    throw new RawResponse(401, 'No token provided\n');
  }

  if (!jwtAuthMethod.jwtConfig) {
    console.log('JWT configuration is missing\n');
    throw withBody(errors.JWT_MISCONFIGURED, { message: 'JWT configuration is missing\n' });
  }

  const { clientID, authorityURL, expectedAudience, roleMapping } = jwtAuthMethod.jwtConfig;
  const audience = expectedAudience || clientID;

  if (!authorityURL) {
    console.log('OIDC authority URL is not configured\n');
    throw withBody(errors.JWT_MISCONFIGURED, {
      message: 'OIDC authority URL is not configured\n',
    });
  }

  if (!clientID) {
    console.log('OIDC client ID is not configured\n');
    throw withBody(errors.JWT_MISCONFIGURED, { message: 'OIDC client ID is not configured\n' });
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
    console.log('JWT validation failed\n');
    throw new RawResponse(401, error || 'JWT validation failed\n');
  }

  req.user = verifiedPayload;
  assignRoles(roleMapping as RoleMapping, verifiedPayload, req.user);

  console.log('JWT validation successful\n');
  return next();
});

export const PASSWORD_CHANGE_REQUIRED_MESSAGE =
  'Password change required before accessing this endpoint';

const passwordChangeErrors = {
  PASSWORD_CHANGE_REQUIRED: messageError(428, PASSWORD_CHANGE_REQUIRED_MESSAGE),
};

/** Blocks users who must change their password before using the endpoint. */
export const requirePasswordChanged = pub
  .errors(passwordChangeErrors)
  .middleware(async ({ context, next, errors }) => {
    if (mustChangePassword(context.req.user)) {
      throw withBody(errors.PASSWORD_CHANGE_REQUIRED, {
        message: PASSWORD_CHANGE_REQUIRED_MESSAGE,
      });
    }
    return next();
  });

/** Procedures gated on a completed password change (auth endpoints off the allowlist). */
export const passwordGated = pub.errors(passwordChangeErrors).use(requirePasswordChanged);

/**
 * Builder for the `/api/v1/{push,repo,user}` routers: JWT authentication, then
 * the password-change gate, in the order the Express routes applied them.
 */
export const guarded = pub
  .errors({ ...jwtErrors, ...passwordChangeErrors })
  .use(jwtAuth)
  .use(requirePasswordChanged);
