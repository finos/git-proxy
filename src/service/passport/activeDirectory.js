/* eslint-disable max-len */
const configure = () => {
  const passport = require('passport');
  const ActiveDirectoryStrategy = require('passport-activedirectory');

  passport.use(
    new ActiveDirectoryStrategy(
      {
        integrated: false,
        ldap: {
          url: 'ldap://20.39.221.61',
          baseDN: 'DC=rebeladmin,DC=com',
          username: 'ta1234@rebeladmin.com',
          password: 'London1234',
        },
      },
      function (profile, ad, done) {
        ad.isUserMemberOf(profile._json.dn, 'proxy_users', (err, isMember) => {
          if (isMember) {
            profile.id = profile._json.userPrincipalName;
          } else {
          }
          if (err) {
            return done(err);
          }
          return done(null, profile);
        });
      },
    ),
  );

  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (user, done) {
    done(null, user);
  });

  passport.type = 'ActiveDirectory';
  return passport;
};

module.exports.configure = configure;
