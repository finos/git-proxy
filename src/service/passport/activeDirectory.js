const configure = () => {
  const passport = require('passport');
  const ActiveDirectoryStrategy = require('passport-activedirectory');
  const adConfig = require('../../config').getAuthentication().adConfig;


  passport.use(new ActiveDirectoryStrategy({
    passReqToCallback: true,
    integrated: false,
    ldap: adConfig,
  }, async function (req, profile, ad, done) {
    profile.id = profile._json.userPrincipalName;

    if (response == true) {
      profile.admin = true;
      profile.adminGroup = true;
      req.user = profile;
    }
    return done(null, profile);
  }));

  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (user, done) {
    done(null, user);
  });

  return passport;
};

module.exports.configure = configure;