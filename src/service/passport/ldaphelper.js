const axios = require('axios');
const thirdpartyApiConfig = require('../../config').getAPIs();
const client = axios.create({
  responseType: 'json',
  headers: {
    'content-type': 'application/json',
  },
});

const isUserInAdGroup = (id, domain, name) => { // TODO - needs reconsideration for parsing string
  const url = String(thirdpartyApiConfig.ls.userInADGroup)
    .replace('<domain>', domain)
    .replace('<name>', name)
    .replace('<id>', id);

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
