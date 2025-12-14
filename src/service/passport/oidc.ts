import * as db from '../../db';
import { PassportStatic } from 'passport';
import { getAuthMethods } from '../../config';
import { type UserInfoResponse } from 'openid-client';

export const type = 'openidconnect';

export const configure = async (passport: PassportStatic): Promise<PassportStatic> => {
  // Use dynamic imports to avoid ESM/CommonJS issues
  const { discovery, fetchUserInfo } = await import('openid-client');
  // @ts-expect-error - throws error due to missing type definitions
  const { Strategy } = await import('openid-client/passport');

  const authMethods = getAuthMethods();
  const oidcConfig = authMethods.find((method) => method.type.toLowerCase() === type)?.oidcConfig;

  if (!oidcConfig || !oidcConfig.issuer) {
    throw new Error('Missing OIDC issuer in configuration');
  }

  const { issuer, clientID, clientSecret, callbackURL, scope } = oidcConfig;

  const server = new URL(issuer);
  let config;

  try {
    config = await discovery(server, clientID, clientSecret);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Error during OIDC discovery: ${msg}`);
    throw new Error(`OIDC setup error (discovery): ${msg}`);
  }

  try {
    const strategy = new Strategy(
      { callbackURL, config, scope },
      async (tokenSet: any, done: (err: unknown, user?: Partial<db.User>) => void) => {
        const idTokenClaims = tokenSet.claims();
        const expectedSub = idTokenClaims.sub;
        const userInfo = await fetchUserInfo(config, tokenSet.access_token, expectedSub);
        handleUserAuthentication(userInfo, done);
      },
    );

    strategy.currentUrl = function (request: Request) {
      const callbackUrl = new URL(callbackURL);
      const currentUrl = Strategy.prototype.currentUrl.call(this, request);
      currentUrl.host = callbackUrl.host;
      currentUrl.protocol = callbackUrl.protocol;
      return currentUrl;
    };

    passport.use(type, strategy);

    passport.serializeUser((user: Partial<db.User>, done) => {
      done(null, user.oidcId || user.username);
    });

    passport.deserializeUser(async (id: string, done) => {
      try {
        const user = await db.findUserByOIDC(id);
        done(null, user);
      } catch (err: unknown) {
        done(err);
      }
    });

    return passport;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`Error during OIDC passport setup: ${msg}`);
    throw new Error(`OIDC setup error (strategy): ${msg}`);
  }
};

/**
 * Handles user authentication with OIDC.
 * @param {UserInfoResponse} userInfo - The user info response from the OIDC provider
 * @param {Function} done - The callback function to handle the user authentication
 * @return {Promise<void>} - A promise that resolves when the user authentication is complete
 */
export const handleUserAuthentication = async (
  userInfo: UserInfoResponse,
  done: (err: unknown, user?: Partial<db.User>) => void,
): Promise<void> => {
  try {
    const user = await db.findUserByOIDC(userInfo.sub);

    if (!user) {
      const email = safelyExtractEmail(userInfo);
      if (!email) return done(new Error('No email found in OIDC profile'));

      const newUser = {
        username: getUsername(email),
        email,
        oidcId: userInfo.sub,
      };

      await db.createUser(newUser.username, '', newUser.email, 'Edit me', false, newUser.oidcId);
      return done(null, newUser);
    }

    return done(null, user);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return done(msg);
  }
};

/**
 * Extracts email from OIDC profile.
 * Different providers use different fields to store the email.
 * @param {UserInfoResponse} profile - The user profile from the OIDC provider
 * @return {string | null} - The email address from the profile
 */
export const safelyExtractEmail = (profile: UserInfoResponse): string | null => {
  if (profile.email) {
    return profile.email;
  }
  if (profile.emails && Array.isArray(profile.emails) && profile.emails.length > 0) {
    return (profile.emails[0] as { value: string }).value;
  }
  return null;
};

/**
 * Generates a username from an email address.
 * This helps differentiate users within the specific OIDC provider.
 * Note: This is incompatible with multiple providers. Ideally, users are identified by
 * OIDC ID (requires refactoring the database).
 * @param {string} email - The email address to generate a username from
 * @return {string} - The username generated from the email address
 */
export const getUsername = (email: string): string => {
  return email ? email.split('@')[0] : '';
};
