const fs = require('fs');
const proxySettings = JSON.parse(fs.readFileSync('./resources/config.json'));

let _userSettings = null;
const userSettings = () => {
  const path = './user-settings.json';

  if (_userSettings === null && fs.existsSync(path)) {
    _userSettings = JSON.parse(fs.readFileSync(path));
  }

  return _userSettings;
};

let _whiteList = proxySettings.repoWhiteList;
const getWhiteList = () => {
  if (userSettings !== null && userSettings.repoWhiteList) {
    _whiteList = userSettings.repoWhiteList;
  }
  return _whiteList;
};

exports.getWhiteList = getWhiteList;
