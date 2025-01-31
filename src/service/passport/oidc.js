const configure = async () => {
  const passport = require('passport');
  const { Strategy: OIDCStrategy } = require('passport-openidconnect');
  const db = require('../../db');

  const config = require('../../config').getAuthentication();
  const oidcConfig = config.oidcConfig;

  passport.use(
    new OIDCStrategy(oidcConfig, async function verify(issuer, profile, cb) {
      try {
        const user = await db.findUserByOIDC(profile.id);

        if (!user) {
          const email = safelyExtractEmail(profile);
          if (!email) {
            return cb(new Error('No email found in OIDC profile'));
          }

          const username = getUsername(email);
          const newUser = {
            username: username,
            email: email,
            oidcId: profile.id,
          };

          await db.createUser(
            newUser.username,
            null,
            newUser.email,
            'Edit me',
            false,
            newUser.oidcId,
          );

          return cb(null, newUser);
        }
        return cb(null, user);
      } catch (err) {
        return cb(err);
      }
    }),
  );

  passport.serializeUser((user, cb) => {
    cb(null, user.oidcId || user.username);
  });

  passport.deserializeUser(async (id, cb) => {
    try {
      const user = (await db.findUserByOIDC(id)) || (await db.findUser(id));
      cb(null, user);
    } catch (err) {
      cb(err);
    }
  });

  passport.type = 'openidconnect';
  return passport;
};

module.exports.configure = configure;

/**
 * Extracts email from OIDC profile.
 * This function is necessary because OIDC providers have different ways of storing emails.
 * @param {object} profile the profile object from OIDC provider
 * @return {string | null} the email address
 */
const safelyExtractEmail = (profile) => {
  if (profile.emails && profile.emails.length > 0) {
    return profile.emails[0].value;
  }

  if (profile.email) {
    return profile.email;
  }
  return null;
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
