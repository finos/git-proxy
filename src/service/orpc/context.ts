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

import type { Request, Response } from 'express';

import type { Proxy } from '../../proxy';
import type { PublicUser, User as DbUser } from '../../db/types';

/**
 * Initial context of every procedure.
 *
 * Express is still the HTTP host, so the raw request and response are exposed
 * for the state that its middleware owns: `req.user` and the session (passport),
 * `req.csrfToken()` (lusca), `req.protocol` (trust proxy) and cookies.
 */
export interface ServiceContext {
  req: Request;
  res: Response;
  proxy: Proxy;
  /**
   * Set when a procedure throws something that is not an `ORPCError`. The
   * Express glue passes it to `next(err)`, so the response is produced by the
   * Express error handler exactly as it was before the oRPC port.
   */
  forwardedError?: unknown;
}

/** The shape of `req.user` once passport or the JWT middleware has populated it. */
export interface SessionUser extends Express.User {
  username: string;
  admin?: boolean;
  mustChangePassword?: boolean;
}

export const getSessionUser = (context: ServiceContext): SessionUser | undefined =>
  context.req.user as SessionUser | undefined;

export function isAdminUser(user?: Express.User): user is SessionUser & { admin: true } {
  return user !== null && user !== undefined && (user as SessionUser).admin === true;
}

export const mustChangePassword = (user?: Express.User): boolean => {
  return user !== null && user !== undefined && (user as SessionUser).mustChangePassword === true;
};

export const toPublicUser = (user: DbUser): PublicUser => {
  const publicUser: PublicUser = {
    username: user.username || '',
    displayName: user.displayName || '',
    email: user.email || '',
    title: user.title || '',
    scmIdentities: { ...(user.scmIdentities || {}) },
    admin: user.admin || false,
  };
  if (user.mustChangePassword) {
    publicUser.mustChangePassword = true;
  }
  return publicUser;
};
