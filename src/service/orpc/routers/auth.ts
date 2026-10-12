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

import { ORPCError } from '@orpc/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { getAuthMethods, getUIHost, getUIPort } from '../../../config';
import { AuthenticationElement } from '../../../config/generated/config';
import * as db from '../../../db';
import { PublicUser, User } from '../../../db/types';
import { getProviderByName } from '../../../proxy/processors/push-action/tokenIdentity';
import { handleErrorAndLog } from '../../../utils/errors';
import { authStrategies, getPassport } from '../../passport';
import * as passportAD from '../../passport/activeDirectory';
import * as passportLocal from '../../passport/local';
import { pub } from '../base';
import { isAdminUser, SessionUser, toPublicUser } from '../context';
import {
  MessageBody,
  messageError,
  PassThrough,
  RawResponse,
  textError,
  withBody,
} from '../errors';
import { passwordGated } from '../middleware';
import { authenticateWithCallback, logIn, runMiddleware } from '../passport';
import { docOnly, documentedUnknown, PublicUserSchema } from '../schemas';

const passport = getPassport();

const PASSWORD_MIN_LENGTH = 8;

const notLoggedIn = { message: 'Not logged in' };

const endpoints = {
  login: {
    action: 'post',
    uri: '/api/auth/login',
  },
  profile: {
    action: 'get',
    uri: '/api/auth/profile',
  },
  logout: {
    action: 'post',
    uri: '/api/auth/logout',
  },
};

const EndpointSchema = z.object({ action: z.string(), uri: z.string() });

const index = pub
  .route({ method: 'GET', path: '/', summary: 'Auth endpoint index' })
  .output(
    docOnly<typeof endpoints>(
      z.object({ login: EndpointSchema, profile: EndpointSchema, logout: EndpointSchema }),
    ),
  )
  .handler(() => endpoints);

// login strategies that will work with /login e.g. take username and password
const appropriateLoginStrategies = [passportLocal.type, passportAD.type];
// getLoginStrategy fetches the enabled auth methods and identifies if there's an appropriate
// auth method for username and password login. If there isn't it returns null, if there is it
// returns the first.
const getLoginStrategy = () => {
  // returns only enabled auth methods
  // returns at least one enabled auth method
  const enabledAppropriateLoginStrategies = getAuthMethods().filter((am: AuthenticationElement) =>
    appropriateLoginStrategies.includes(am.type.toLowerCase()),
  );
  // for where no login strategies which work for /login are enabled
  // just return null
  if (enabledAppropriateLoginStrategies.length === 0) {
    return null;
  }
  // return the first enabled auth method
  return enabledAppropriateLoginStrategies[0].type.toLowerCase();
};

type LoginSuccessResponse = { message: 'success'; user: PublicUser };

/**
 * Builds the body sent after a successful username/password login.
 * @param {Express.User} user the logged-in user (`req.user`)
 * @return {LoginSuccessResponse} the response body
 */
export const buildLoginSuccessResponse = (user?: Express.User): LoginSuccessResponse => {
  const currentUser = toPublicUser({ ...user } as User);
  console.log(
    `serivce.routes.auth.login: user logged in, username=${
      currentUser.username
    } profile=${JSON.stringify(currentUser)}`,
  );
  return {
    message: 'success',
    user: currentUser,
  };
};

const config = pub
  .route({ method: 'GET', path: '/config', summary: 'Enabled authentication methods' })
  .output(
    docOnly<{ usernamePasswordMethod: string | null; otherMethods: string[] }>(
      z.object({
        usernamePasswordMethod: z.string().nullable(),
        otherMethods: z.array(z.string()),
      }),
    ),
  )
  .handler(() => {
    const usernamePasswordMethod = getLoginStrategy();
    return {
      // enabled username /password auth method
      usernamePasswordMethod: usernamePasswordMethod,
      // other enabled auth methods
      otherMethods: getAuthMethods()
        .map((am) => am.type.toLowerCase())
        .filter((authType) => authType !== usernamePasswordMethod),
    };
  });

// TODO: provide separate auth endpoints for each auth strategy or chain compatibile auth strategies
// TODO: if providing separate auth methods, inform the frontend so it has relevant UI elements and appropriate client-side behavior
const login = pub
  .route({ method: 'POST', path: '/login', summary: 'Log in with username and password' })
  .errors({
    FORBIDDEN: textError(403, 'Username and Password based Login is not enabled at this time'),
    UNAUTHORIZED: textError(401, 'Unauthorized'),
    INTERNAL_SERVER_ERROR: textError(500, 'Failed to login'),
  })
  .input(
    z.object({
      body: z
        .looseObject({ username: z.string().optional(), password: z.string().optional() })
        .optional(),
    }),
  )
  .output(
    docOnly<LoginSuccessResponse | undefined>(
      z.object({ message: z.literal('success'), user: PublicUserSchema }),
    ),
  )
  .handler(async ({ context }) => {
    const authType = getLoginStrategy();
    if (authType === null) {
      throw new RawResponse(403, 'Username and Password based Login is not enabled at this time');
    }
    console.log('going to auth with', authType);

    const outcome = await runMiddleware(passport.authenticate(authType), context.req, context.res);
    if (outcome === 'responded') {
      // passport has already answered (401 Unauthorized, 400 Bad Request)
      return undefined;
    }

    try {
      return buildLoginSuccessResponse(context.req.user);
    } catch (error: unknown) {
      const msg = handleErrorAndLog(error, 'Error logging user in');
      throw new RawResponse(500, `Failed to login: ${msg}`);
    }
  });

const openidconnect = pub
  .route({
    method: 'GET',
    path: '/openidconnect',
    summary: 'Start an OpenID Connect login (redirects to the identity provider)',
  })
  .output(docOnly<undefined>(z.undefined()))
  .handler(async ({ context }) => {
    const outcome = await runMiddleware(
      passport.authenticate(authStrategies['openidconnect'].type),
      context.req,
      context.res,
    );
    if (outcome === 'next') {
      throw new PassThrough();
    }
    return undefined;
  });

const openidconnectCallback = pub
  .route({
    method: 'GET',
    path: '/openidconnect/callback',
    summary: 'OpenID Connect callback (redirects to the UI profile page)',
    outputStructure: 'detailed',
  })
  .output(
    docOnly<{ status?: number; headers?: Record<string, string> }>(
      z.object({ status: z.literal(302), headers: z.object({ location: z.string() }) }),
    ),
  )
  .handler(async ({ context }) => {
    const result = await authenticateWithCallback(
      passport,
      authStrategies['openidconnect'].type,
      context.req,
      context.res,
    );
    if (result === 'responded') {
      return {};
    }
    if (result === 'next') {
      throw new PassThrough();
    }

    const { err, user, info } = result;
    if (err) {
      console.error('Authentication error:', err);
      throw new RawResponse(500);
    }
    if (!user) {
      console.error('No user found:', info);
      throw new RawResponse(401);
    }

    try {
      await logIn(context.req, user as Express.User);
    } catch (err: unknown) {
      console.error('Login error:', err);
      throw new RawResponse(500);
    }

    console.log('Logged in successfully. User:', user);
    return {
      status: 302,
      headers: { location: `${getUIHost()}:${getUIPort()}/dashboard/profile` },
    };
  });

const logout = pub
  .route({ method: 'POST', path: '/logout', summary: 'Log out' })
  .output(
    docOnly<{ isAuth: boolean; user: Express.User | undefined }>(
      z.object({ isAuth: z.boolean(), user: z.null() }),
    ),
  )
  .handler(({ context }) => {
    const { req, res } = context;
    req.logout((err: unknown) => {
      // The response is already on its way; Express used to receive this via next(err).
      if (err) handleErrorAndLog(err, 'Error logging out');
    });
    res.clearCookie('connect.sid');
    return { isAuth: req.isAuthenticated(), user: req.user };
  });

const changePassword = pub
  .route({
    method: 'POST',
    path: '/change-password',
    summary: "Change the current user's password",
  })
  .errors({
    UNAUTHORIZED: messageError(401),
    BAD_REQUEST: messageError(400),
    NOT_FOUND: messageError(404, 'User not found'),
    INTERNAL_SERVER_ERROR: messageError(500),
  })
  .input(
    z.object({
      body: z
        .looseObject({
          currentPassword: documentedUnknown({ type: 'string' }),
          newPassword: documentedUnknown({
            type: 'string',
            minLength: PASSWORD_MIN_LENGTH,
          }),
        })
        .optional(),
    }),
  )
  .output(docOnly<{ message: string }>(MessageBody))
  .handler(async ({ context, input, errors }) => {
    if (!context.req.user) {
      throw withBody(errors.UNAUTHORIZED, notLoggedIn);
    }

    const { currentPassword, newPassword } = input.body ?? {};
    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      currentPassword.trim().length === 0 ||
      newPassword.trim().length < PASSWORD_MIN_LENGTH
    ) {
      throw withBody(errors.BAD_REQUEST, {
        message: `currentPassword and newPassword are required, and newPassword must be at least ${PASSWORD_MIN_LENGTH} characters`,
      });
    }

    if (currentPassword === newPassword) {
      throw withBody(errors.BAD_REQUEST, {
        message: 'newPassword must be different from currentPassword',
      });
    }

    try {
      const user = await db.findUser((context.req.user as SessionUser).username);
      if (!user) {
        throw withBody(errors.NOT_FOUND, { message: 'User not found' });
      }

      if (!user.password) {
        throw withBody(errors.BAD_REQUEST, {
          message: 'Password changes are not supported for this account',
        });
      }

      const currentPasswordCorrect = await bcrypt.compare(currentPassword, user.password ?? '');
      if (!currentPasswordCorrect) {
        throw withBody(errors.UNAUTHORIZED, { message: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.updateUser({
        username: user.username,
        password: hashedPassword,
        mustChangePassword: false,
      });

      (context.req.user as SessionUser).mustChangePassword = false;

      return { message: 'Password updated successfully' };
    } catch (error: unknown) {
      if (error instanceof ORPCError) throw error;
      const msg = handleErrorAndLog(error, 'Failed to update password');
      throw withBody(errors.INTERNAL_SERVER_ERROR, { message: msg });
    }
  });

const profile = pub
  .route({ method: 'GET', path: '/profile', summary: 'Current user profile' })
  .errors({
    UNAUTHORIZED: messageError(401, 'Not logged in'),
    NOT_FOUND: messageError(404, 'User not found'),
  })
  .output(docOnly<PublicUser>(PublicUserSchema))
  .handler(async ({ context, errors }) => {
    if (!context.req.user) {
      throw withBody(errors.UNAUTHORIZED, notLoggedIn);
    }

    const userVal = await db.findUser((context.req.user as SessionUser).username);
    if (!userVal) {
      throw withBody(errors.NOT_FOUND, { message: 'User not found' });
    }

    return toPublicUser(userVal);
  });

const scmIdentity = passwordGated
  .route({ method: 'POST', path: '/scm-identity', summary: 'Link or unlink an SCM identity' })
  .errors({
    UNAUTHORIZED: messageError(401, 'Not logged in'),
    BAD_REQUEST: messageError(400),
    FORBIDDEN: messageError(403, 'Must be an admin to update a different account'),
    NOT_FOUND: messageError(404, 'User not found'),
    INTERNAL_SERVER_ERROR: messageError(500),
  })
  .input(
    z.object({
      body: z
        .looseObject({
          provider: documentedUnknown({ type: 'string' }),
          login: documentedUnknown({ type: ['string', 'null'] }),
          username: documentedUnknown({ type: 'string' }),
        })
        .optional(),
    }),
  )
  .output(docOnly<{ message: string }>(MessageBody))
  .handler(async ({ context, input, errors }) => {
    if (!context.req.user) {
      throw withBody(errors.UNAUTHORIZED, notLoggedIn);
    }

    try {
      const body = input.body as { provider?: string; login?: string | null; username?: string };
      const { provider, login } = body;
      const username: string = body.username || (context.req.user as SessionUser).username;

      if (!provider || typeof provider !== 'string') {
        throw withBody(errors.BAD_REQUEST, {
          message: 'Missing provider. SCM identity not updated',
        });
      }

      if (!getProviderByName(provider)) {
        throw withBody(errors.BAD_REQUEST, {
          message: `Unknown SCM provider '${provider}'. SCM identity not updated`,
        });
      }

      const reqUser = await db.findUser((context.req.user as SessionUser).username);
      if (username !== reqUser?.username && !reqUser?.admin) {
        throw withBody(errors.FORBIDDEN, {
          message: 'Must be an admin to update a different account',
        });
      }

      const user = await db.findUser(username);
      if (!user) {
        throw withBody(errors.NOT_FOUND, { message: 'User not found' });
      }

      await db.setUserScmIdentity(user.username, provider, login ?? null);
      return { message: 'SCM identity updated successfully' };
    } catch (error: unknown) {
      if (error instanceof ORPCError) throw error;
      const msg = handleErrorAndLog(error, 'Failed to update SCM identity');
      throw withBody(errors.INTERNAL_SERVER_ERROR, { message: msg });
    }
  });

const createUser = passwordGated
  .route({
    method: 'POST',
    path: '/create-user',
    summary: 'Create a local user (admin only)',
    successStatus: 201,
  })
  .errors({
    FORBIDDEN: messageError(403, 'Not authorized to create users'),
    BAD_REQUEST: messageError(400),
    INTERNAL_SERVER_ERROR: messageError(500),
  })
  .input(
    z.object({
      body: z
        .looseObject({
          username: z.string().optional(),
          password: z.string().optional(),
          email: z.string().optional(),
          scmIdentities: documentedUnknown({
            type: 'object',
            additionalProperties: { type: 'string' },
          }),
          admin: documentedUnknown({ type: 'boolean' }),
        })
        .optional(),
    }),
  )
  .output(
    docOnly<{ message: string; username: string }>(
      z.object({ message: z.string(), username: z.string() }),
    ),
  )
  .handler(async ({ context, input, errors }) => {
    if (!isAdminUser(context.req.user)) {
      throw withBody(errors.FORBIDDEN, { message: 'Not authorized to create users' });
    }

    try {
      const {
        username,
        password,
        email,
        scmIdentities = {},
        admin: isAdmin = false,
      } = input.body as {
        username?: string;
        password?: string;
        email?: string;
        scmIdentities?: unknown;
        admin?: unknown;
      };

      if (!username || !password || !email) {
        throw withBody(errors.BAD_REQUEST, {
          message: 'Missing required fields: username, password, and email are required',
        });
      }

      if (
        typeof scmIdentities !== 'object' ||
        Array.isArray(scmIdentities) ||
        // null passes the checks above and throws here, answered with a 500 as before
        Object.entries(scmIdentities as object).some(
          ([provider, login]) => typeof login !== 'string' || !getProviderByName(provider),
        )
      ) {
        throw withBody(errors.BAD_REQUEST, {
          message: 'scmIdentities must map configured provider names to account names',
        });
      }

      await db.createUser(
        username,
        password,
        email,
        isAdmin as boolean,
        '',
        false,
        scmIdentities as Record<string, string>,
      );
      return {
        message: 'User created successfully',
        username,
      };
    } catch (error: unknown) {
      if (error instanceof ORPCError) throw error;
      const msg = handleErrorAndLog(error, 'Failed to create user');
      throw withBody(errors.INTERNAL_SERVER_ERROR, { message: msg });
    }
  });

const csrfToken = passwordGated
  .route({ method: 'GET', path: '/csrf-token', summary: 'CSRF token for the session' })
  .output(docOnly<{ csrfToken: string }>(z.object({ csrfToken: z.string() })))
  .handler(({ context }) => {
    console.log('req.user', context.req.user);
    return { csrfToken: (context.req as any).csrfToken() };
  });

export const authRouter = {
  index,
  config,
  login,
  openidconnect,
  openidconnectCallback,
  logout,
  changePassword,
  profile,
  scmIdentity,
  createUser,
  csrfToken,
};
