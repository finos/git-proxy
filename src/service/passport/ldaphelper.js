const config = require('../../config').getAuthentication();
const thirdpartyApiConfig = require('../../config').getAPIs();
const axios = require('axios');

const isUserInAdGroup = (req, profile, ad, domain, name) => {
  // determine, via config, if we're using HTTP or AD directly
  if (thirdpartyApiConfig?.ls?.userInADGroup) {
    return isUserInAdGroupViaHttp(profile.username, domain, name);
  } else if (config.adConfig) {
    return isUserInAdGroupViaAD(req, profile, ad, domain, name);
  } else {
    console.error('Unable to check user groups as config is incomplete or unreadable');
  }
};

const isUserInAdGroupViaAD = (req, profile, ad, domain, name) => {

  return new Promise((resolve, reject) => {
    ad.isUserMemberOf(profile.username, name, function (err, isMember) {
      if (err) {
        const msg = 'ERROR isUserMemberOf: ' + JSON.stringify(err);
        reject(msg);
      } else {
        console.log(profile.username + ' isMemberOf ' + name + ': ' + isMember);
        resolve(isMember);
      }
    });
  });
};

const isUserInAdGroupViaHttp = (id, domain, name) => {
  const url = String(thirdpartyApiConfig.ls.userInADGroup)
    .replace('<domain>', domain)
    .replace('<name>', name)
    .replace('<id>', id);

  const client = axios.create({
    responseType: 'json',
    headers: {
      'content-type': 'application/json',
    },
  });

  console.log(`checking if user is in group ${url}`);
  return client
    .get(url)
    .then((res) => res.data)
    .catch(() => {
      return false;
    });
};

module.exports = {
  isUserInAdGroup,
};
