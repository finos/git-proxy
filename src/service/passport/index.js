const passport = require("passport");
const local = require('./local');
const activeDirectory = require('./activeDirectory');
const oidc = require('./oidc');
const config = require('../../config');

const authStrategies = {
  local: local,
  activedirectory: activeDirectory,
  openidconnect: oidc,
};

const configure = async () => {
  passport.initialize();

  const authMethods = config.getAuthMethods();

  for (const auth of authMethods) {
    const strategy = authStrategies[auth.type.toLowerCase()];
    if (strategy && typeof strategy.configure === "function") {
      await strategy.configure(passport);
    }
  }

  if (authMethods.some(auth => auth.type.toLowerCase() === "local")) {
    await local.createDefaultAdmin();
  }

  return passport;
};

module.exports.configure = configure;
module.exports.getPassport = () => passport;
