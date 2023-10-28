const fs = require('fs');

const defaultSettings = require('../../proxy.config.json');
const userSettingsPath = require('./file').configFile;

let _userSettings = null;
if (fs.existsSync(userSettingsPath)) {
  _userSettings = JSON.parse(fs.readFileSync(userSettingsPath));
}
let _authorisedList = defaultSettings.authorisedList;
let _database = defaultSettings.sink;
let _authentication = defaultSettings.authentication;
let _tempPassword = defaultSettings.tempPassword;

// Gets a list of authorised repositories
const getAuthorisedList = () => {
  if (_userSettings !== null && _userSettings.authorisedList) {
    _authorisedList = _userSettings.authorisedList;
  }

  return _authorisedList;
};

// Gets a list of authorised repositories
const getTempPasswordConfig = () => {
  if (_userSettings !== null && _userSettings.tempPassword) {
    _tempPassword = _userSettings.tempPassword;
  }

  return _tempPassword;
};

// Gets the configuared data sink, defaults to filesystem
const getDatabase = () => {
  if (_userSettings !== null && _userSettings.sink) {
    _database = _userSettings.sink;
  }
  for (const ix in _database) {
    if (ix) {
      const db = _database[ix];
      if (db.enabled) {
        return db;
      }
    }
  }

  throw Error('No database cofigured!');
};

// Gets the configuared data sink, defaults to filesystem
const getAuthentication = () => {
  if (_userSettings !== null && _userSettings.authentication) {
    _authentication = _userSettings.authentication;
  }
  for (const ix in _authentication) {
    if (!ix) continue;
    const auth = _authentication[ix];
    if (auth.enabled) {
      return auth;
    }
  }

  throw Error('No authentication cofigured!');
};

// Log configuration to console
const logConfiguration = () => {
  console.log(`authorisedList = ${JSON.stringify(getAuthorisedList())}`);
  console.log(`data sink = ${JSON.stringify(getDatabase())}`);
  console.log(`authentication = ${JSON.stringify(getAuthentication())}`);
};

// logConfiguration();

exports.getAuthorisedList = getAuthorisedList;
exports.getDatabase = getDatabase;
exports.logConfiguration = logConfiguration;
exports.getAuthentication = getAuthentication;
exports.getTempPasswordConfig = getTempPasswordConfig;
