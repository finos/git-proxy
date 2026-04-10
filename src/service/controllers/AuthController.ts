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

import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import {
  Body,
  Controller,
  Get,
  Middlewares,
  Post,
  Request,
  Res,
  Route,
  Tags,
  TsoaResponse,
} from 'tsoa';
import { getPassport, authStrategies } from '../passport';
import { getAuthMethods } from '../../config';
import * as db from '../../db';
import * as passportLocal from '../passport/local';
import * as passportAD from '../passport/activeDirectory';
import { User } from '../../db/types';
import { AuthenticationElement } from '../../config/generated/config';
import { isAdminUser, toPublicUser } from '../routes/utils';
import { handleErrorAndLog } from '../../utils/errors';
import { PublicUser } from '../../db/types';

const { GIT_PROXY_UI_HOST: uiHost = 'http://localhost', GIT_PROXY_UI_PORT: uiPort = 3000 } =
  process.env;

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

/**
 * Dynamically selects the login passport strategy and runs it as Express middleware.
 * Used by `@Middlewares` on the POST /login route.
 */
export function dynamicLoginMiddleware(
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction,
): void {
  const authType = getLoginStrategy();
  if (authType === null) {
    res.status(403).send('Username and Password based Login is not enabled at this time').end();
    return;
  }
  getPassport().authenticate(authType)(req, res, next);
}

/**
 * Handles the OIDC callback: authenticates the user and redirects on success.
 * Used by @Middlewares on the GET /openidconnect/callback route.
 */
export function oidcCallbackMiddleware(
  req: ExpressRequest,
  res: ExpressResponse,
  next: NextFunction,
): void {
  getPassport().authenticate(
    authStrategies['openidconnect'].type,
    (err: unknown, user: Partial<db.User>, info: unknown) => {
      if (err) {
        console.error('Authentication error:', err);
        return res.status(500).end();
      }
      if (!user) {
        console.error('No user found:', info);
        return res.status(401).end();
      }
      req.logIn(user, (err) => {
        if (err) {
          console.error('Login error:', err);
          return res.status(500).end();
        }
        console.log('Logged in successfully. User:', user);
        return res.redirect(`${uiHost}:${uiPort}/dashboard/profile`);
      });
    },
  )(req, res, next);
}

// ---------- Response types ----------

interface AuthResources {
  login: { action: 'post'; uri: string };
  profile: { action: 'get'; uri: string };
  logout: { action: 'post'; uri: string };
}

interface AuthConfigResponse {
  usernamePasswordMethod: string | null;
  otherMethods: string[];
}

interface LoginResponse {
  message: 'success';
  user: PublicUser;
}

interface LogoutResponse {
  isAuth: boolean;
  user: Express.User | undefined;
}

interface CreateUserResponse {
  message: string;
  username: string;
}

interface GitAccountBody {
  username?: string;
  id?: string;
  gitAccount: string;
}

interface CreateUserBody {
  username: string;
  password: string;
  email: string;
  gitAccount: string;
  admin?: boolean;
}

/**
 * Authentication endpoints.
 */
@Route('api/auth')
@Tags('Auth')
export class AuthController extends Controller {
  /**
   * Returns links to the available authentication resource endpoints.
   */
  @Get('/')
  public getResources(): AuthResources {
    return {
      login: { action: 'post', uri: '/api/auth/login' },
      profile: { action: 'get', uri: '/api/auth/profile' },
      logout: { action: 'post', uri: '/api/auth/logout' },
    };
  }

  /**
   * Returns the enabled authentication methods available to the UI.
   */
  @Get('/config')
  public getAuthConfig(): AuthConfigResponse {
    const usernamePasswordMethod = getLoginStrategy();
    return {
      // enabled username /password auth method
      usernamePasswordMethod,
      // other enabled auth methods
      otherMethods: getAuthMethods()
        .map((am) => am.type.toLowerCase())
        .filter((authType) => authType !== usernamePasswordMethod),
    };
  }

  // TODO: provide separate auth endpoints for each auth strategy or chain compatibile auth strategies
  // TODO: if providing separate auth methods, inform the frontend so it has relevant UI elements and appropriate client-side behavior
  /**
   * Authenticates the user with a username/password strategy.
   * The appropriate passport strategy is selected dynamically based on configuration.
   */
  @Post('/login')
  @Middlewares(dynamicLoginMiddleware)
  public async login(@Request() req: ExpressRequest): Promise<LoginResponse> {
    // dynamicLoginMiddleware has already authenticated the user and set req.user.
    // If strategy called next(), we can log in and return the user profile.
    const user = req.user as User;

    await new Promise<void>((resolve, reject) => {
      req.logIn(user, (err) => (err ? reject(err) : resolve()));
    });

    const currentUser = toPublicUser(user);
    console.log(
      `service.routes.auth.login: user logged in, username=${currentUser.username} profile=${JSON.stringify(currentUser)}`,
    );
    return { message: 'success', user: currentUser };
  }

  /**
   * Initiates the OpenID Connect authentication flow (redirects to the OIDC provider).
   * @hidden
   */
  @Get('/openidconnect')
  @Middlewares(getPassport().authenticate(authStrategies['openidconnect'].type))
  public initiateOIDC(): void {
    // Passport middleware handles the redirect. This body is unreachable.
  }

  /**
   * OpenID Connect callback — exchanges the authorization code for a session.
   * @hidden
   */
  @Get('/openidconnect/callback')
  @Middlewares(oidcCallbackMiddleware)
  public handleOIDCCallback(): void {
    // oidcCallbackMiddleware handles login and redirect. This body is unreachable.
  }

  /**
   * Logs out the current user and clears the session cookie.
   */
  @Post('/logout')
  public async logout(@Request() req: ExpressRequest): Promise<LogoutResponse> {
    await new Promise<void>((resolve, reject) => {
      req.logout((err: unknown) => (err ? reject(err) : resolve()));
    });
    req.res?.clearCookie('connect.sid');
    return { isAuth: req.isAuthenticated(), user: req.user };
  }

  /**
   * Returns the profile of the currently authenticated user.
   */
  @Get('/profile')
  public async getProfile(
    @Request() req: ExpressRequest,
    @Res() unauthorisedResponse: TsoaResponse<401, { message: string }>,
    @Res() notFoundResponse: TsoaResponse<404, { message: string }>,
  ): Promise<PublicUser> {
    if (!req.user) {
      return unauthorisedResponse(401, { message: 'Not logged in' });
    }

    const userVal = await db.findUser((req.user as User).username);
    if (!userVal) {
      return notFoundResponse(404, { message: 'User not found' });
    }

    return toPublicUser(userVal);
  }

  /**
   * Updates the Git account (username) of a user.
   * Admins may update any user; non-admins may only update their own account.
   */
  @Post('/gitAccount')
  public async updateGitAccount(
    @Body() body: GitAccountBody,
    @Request() req: ExpressRequest,
    @Res() unauthorisedResponse: TsoaResponse<401, { message: string }>,
    @Res() notFoundResponse: TsoaResponse<404, { message: string }>,
    @Res() validationErrorResponse: TsoaResponse<400, { message: string }>,
    @Res() forbiddenResponse: TsoaResponse<403, { message: string }>,
    @Res() internalServerErrorResponse: TsoaResponse<500, { message: string }>,
  ): Promise<void> {
    if (!req.user) {
      return unauthorisedResponse(401, { message: 'Not logged in' });
    }

    try {
      let username =
        body.username == null || body.username === 'undefined' ? body.id : body.username;
      username = username?.split('@')[0];

      if (!username) {
        return validationErrorResponse(400, {
          message: 'Missing username. Git account not updated',
        });
      }

      const reqUser = await db.findUser((req.user as User).username);
      if (username !== reqUser?.username && !reqUser?.admin) {
        return forbiddenResponse(403, {
          message: 'Must be an admin to update a different account',
        });
      }

      const user = await db.findUser(username);
      if (!user) {
        return notFoundResponse(404, { message: 'User not found' });
      }

      user.gitAccount = body.gitAccount;
      await db.updateUser(user);
      this.setStatus(200);
    } catch (error: unknown) {
      const msg = handleErrorAndLog(error, 'Failed to update git account');
      return internalServerErrorResponse(500, { message: msg });
    }
  }

  /**
   * Creates a new user. Requires admin privileges.
   */
  @Post('/create-user')
  public async createUser(
    @Body() body: CreateUserBody,
    @Request() req: ExpressRequest,
    @Res() unauthorisedResponse: TsoaResponse<403, { message: string }>,
    @Res() internalServerErrorResponse: TsoaResponse<500, { message: string }>,
  ): Promise<CreateUserResponse> {
    if (!isAdminUser(req.user)) {
      return unauthorisedResponse(403, { message: 'Not authorized to create users' });
    }

    const { username, password, email, gitAccount, admin: isAdmin = false } = body;

    try {
      await db.createUser(username, password, email, gitAccount, isAdmin);
      this.setStatus(201);
      return { message: 'User created successfully', username };
    } catch (error: unknown) {
      const msg = handleErrorAndLog(error, 'Failed to create user');
      return internalServerErrorResponse(500, { message: msg });
    }
  }
}
