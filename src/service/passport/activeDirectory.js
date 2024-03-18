const configure = () => {
  const passport = require('passport');
  const ActiveDirectoryStrategy = require('passport-activedirectory');
  const config = require('../../config').getAuthentication();
  const adConfig = config.adConfig;
  const db = require('../../db');
  const userGroup = config.userGroup;
  const adminGroup = config.adminGroup;
  const domain = config.domain;

  console.log(`AD User Group: ${userGroup}, AD Admin Group: ${adminGroup}`);

  const ldaphelper = require('./ldaphelper');
  passport.use(
    new ActiveDirectoryStrategy(
      {
        passReqToCallback: true,
        integrated: false,
        ldap: adConfig,
      },
      async function (req, profile, ad, done) {
        profile.username = profile._json.sAMAccountName.toLowerCase();
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
      },
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

module.exports.configure = configure;
