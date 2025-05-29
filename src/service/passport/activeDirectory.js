const ActiveDirectoryStrategy = require('passport-activedirectory');
const ldaphelper = require('./ldaphelper');

const type = "activedirectory";

const configure = (passport) => {
  const db = require('../../db');

  // We can refactor this by normalizing auth strategy config and pass it directly into the configure() function,
  // ideally when we convert this to TS.
  const authMethods = require('../../config').getAuthMethods();
  const config = authMethods.find((method) => method.type.toLowerCase() === "activeDirectory");
  const adConfig = config.adConfig;

  const { userGroup, adminGroup, domain } = config;

  console.log(`AD User Group: ${userGroup}, AD Admin Group: ${adminGroup}`);

  passport.use(
    type,
    new ActiveDirectoryStrategy(
      {
        passReqToCallback: true,
        integrated: false,
        ldap: adConfig,
      },
      async function (req, profile, ad, done) {
        try {
          profile.username = profile._json.sAMAccountName?.toLowerCase();
          profile.email = profile._json.mail;
          profile.id = profile.username;
          req.user = profile;

          console.log(
            `passport.activeDirectory: resolved login ${
              profile._json.userPrincipalName
            }, profile=${JSON.stringify(profile)}`,
          );
          // First check to see if the user is in the usergroups
          const isUser = await ldaphelper.isUserInAdGroup(profile.username, domain, userGroup);

          if (!isUser) {
            const message = `User it not a member of ${userGroup}`;
            return done(message, null);
          }

          // Now check if the user is an admin
          const isAdmin = await ldaphelper.isUserInAdGroup(profile.username, domain, adminGroup);

          profile.admin = isAdmin;
          console.log(`passport.activeDirectory: ${profile.username} admin=${isAdmin}`);

          const user = {
            username: profile.username,
            admin: isAdmin,
            email: profile._json.mail,
            displayName: profile.displayName,
            title: profile._json.title,
          };

          await db.updateUser(user);

          return done(null, user);
        } catch (err) {
          console.log(`Error authenticating AD user: ${err.message}`);
          return done(err, null);
        }
      }
    ),
  );

  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (user, done) {
    done(null, user);
  });

  return passport;
};

module.exports = { configure, type };
