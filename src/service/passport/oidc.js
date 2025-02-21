const openIdClient = require('openid-client');
const { Strategy } = require('openid-client/passport');
const passport = require('passport');
const db = require('../../db');

let type;

const configure = async () => {
  const authMethods = require('../../config').getAuthMethods();
  const oidcConfig = authMethods.find((method) => method.type.toLowerCase() === "openidconnect")?.oidcConfig;
  const { issuer, clientID, clientSecret, callbackURL, scope } = oidcConfig;

  if (!oidcConfig || !oidcConfig.issuer) {
    throw new Error('Missing OIDC issuer in configuration')
  }

  const server = new URL(issuer);

  try {
    const config = await openIdClient.discovery(server, clientID, clientSecret);

    const strategy = new Strategy({ callbackURL, config, scope }, async (tokenSet, done) => {
      // Validate token sub for added security
      const idTokenClaims = tokenSet.claims();
      const expectedSub = idTokenClaims.sub;
      const userInfo = await openIdClient.fetchUserInfo(config, tokenSet.access_token, expectedSub);
      handleUserAuthentication(userInfo, done);
    });
    
    // currentUrl must be overridden to match the callback URL
    strategy.currentUrl = (request) => {
      const callbackUrl = new URL(callbackURL);
      const currentUrl = Strategy.prototype.currentUrl.call(this, request);
      currentUrl.host = callbackUrl.host;
      currentUrl.protocol = callbackUrl.protocol;
      return currentUrl;
    };

    passport.use(strategy);

    passport.serializeUser((user, done) => {
      done(null, user.oidcId || user.username);
    })

    passport.deserializeUser(async (id, done) => {
      try {
        const user = await db.findUserByOIDC(id);
        done(null, user);
      } catch (err) {
        done(err);
      }
    })
    console.log(`setting type to ${server.host}`)
    type = server.host;

    return passport;
  } catch (error) {
    console.error('OIDC configuration failed:', error);
    throw error;
  }
};

/**
 * Handles user authentication with OIDC.
 * @param userInfo the OIDC user info object 
 * @param done the callback function
 * @returns a promise with the authenticated user or an error
 */
const handleUserAuthentication = async (userInfo, done) => {
  try {
    let user = await db.findUserByOIDC(userInfo.sub);

    if (!user) {
      const email = safelyExtractEmail(userInfo);
      if (!email) return done(new Error('No email found in OIDC profile'));

      const newUser = {
        username: getUsername(email),
        email,
        oidcId: userInfo.sub,
      };

      await db.createUser(newUser.username, null, newUser.email, 'Edit me', false, newUser.oidcId);
      return done(null, newUser);
    }

    return done(null, user);
  } catch (err) {
    return done(err);
  }
};

/**
 * Extracts email from OIDC profile.
 * This function is necessary because OIDC providers have different ways of storing emails.
 * @param {object} profile the profile object from OIDC provider
 * @return {string | null} the email address
 */
const safelyExtractEmail = (profile) => {
  return profile.email || (profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null);
};

/**
 * Generates a username from email address.
 * This helps differentiate users within the specific OIDC provider.
 * Note: This is incompatible with multiple providers. Ideally, users are identified by
 * OIDC ID (requires refactoring the database).
 * @param {string} email the email address
 * @return {string} the username
 */
const getUsername = (email) => {
  return email ? email.split('@')[0] : '';
};

module.exports = {
  configure,
  get type() {
    return type;
  }
};
