const fs = require('fs');
const proxySettings = JSON.parse(fs.readFileSync('./resources/config.json'));

let _userSettings = null;
let _authorisedList = proxySettings.authorisedList;
let _sink =  proxySettings.sink;

const userSettings = () => {
  const path = './user-settings.json';
  if (_userSettings === null && fs.existsSync(path)) {
    _userSettings = JSON.parse(fs.readFileSync(path));
  }
  return _userSettings;
};

// Gets a list of authorised repositories
const getAuthorisedList = () => {
  if (userSettings !== null && userSettings.authorisedList) {
    _authorisedList = userSettings.authorisedList;
  }
  return _authorisedList;
};

// Gets the configuared data sink, defaults to filesystem
const getSink = () => {
  if (userSettings !== null && userSettings.sink) {
    _sink = userSettings.sink;
  }
  return _sink;
};

// Log configuration to console
const logConfiguration = () => {
  console.log(`authorisedList = ${JSON.stringify(getAuthorisedList())}`);
  console.log(`data sink = ${JSON.stringify(getSink())}`);
}

logConfiguration();

exports.getAuthorisedList = getAuthorisedList;
exports.getSink = getSink;
exports.logConfiguration = logConfiguration;
