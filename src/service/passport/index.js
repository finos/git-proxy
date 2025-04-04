const passport = require("passport");
const local = require('./local');
const activeDirectory = require('./activeDirectory');
const oidc = require('./oidc');
const jwt = require('./jwt');
const config = require('../../config');

// Allows obtaining strategy config function and type
// Keep in mind to add AuthStrategy enum when refactoring this to TS
const authStrategies = {
  local: local,
  activedirectory: activeDirectory,
  openidconnect: oidc,
  jwt: jwt,
};

const configure = async () => {
  passport.initialize();

  const authMethods = config.getAuthMethods();
  console.log(`authMethods: ${JSON.stringify(authMethods)}`);

  for (const auth of authMethods) {
    const strategy = authStrategies[auth.type.toLowerCase()];
    if (strategy && typeof strategy.configure === "function") {
      await strategy.configure(passport);
    }
    console.log(`strategy type for ${auth.type}: ${strategy.type}`);
  }

  if (authMethods.some(auth => auth.type.toLowerCase() === "local")) {
    await local.createDefaultAdmin();
  }

  return passport;
};

const getPassport = () => passport;

module.exports = { authStrategies, configure, getPassport };
