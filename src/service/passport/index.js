const local = require('./local');
const activeDirectory = require('./activeDirectory');
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
    default:
      throw Error(`uknown authentication type ${type}`);
  }
  _passport.type = authenticationConfig.type;

  return _passport;
};

module.exports.configure = configure;
module.exports.getPassport = () => {
  return _passport;
};
