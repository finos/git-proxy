const local = require('./local');
const activeDirectory = require('./activeDirectory');
const oidc = require('./oidc');
const config = require('../../config');
const authenticationConfig = config.getAuthentication();
let _passport;

const configure = async () => {
  const type = authenticationConfig.type.toLowerCase();

  switch (type) {
    case 'activedirectory':
      _passport = await activeDirectory.configure();
      break;
    case 'local':
      _passport = await local.configure();
      break;
    case 'openidconnect':
      _passport = await oidc.configure();
      break;
    default:
      throw Error(`unknown authentication type ${type}`);
  }
  if (!_passport.type) {
    _passport.type = type;
  }
  return _passport;
};

module.exports.configure = configure;
module.exports.getPassport = () => {
  return _passport;
};
