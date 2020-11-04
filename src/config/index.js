const fs = require('fs');
const proxySettings = JSON.parse(fs.readFileSync('./resources/config.json'));

let _userSettings = null;
let _authorisedList = proxySettings.authorisedList;
let _database =  proxySettings.sink;
let _authentication =  proxySettings.authentication;

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
const getDatabase = () => {
  if (userSettings !== null && userSettings.sink) {
    _database = userSettings.database;
  }
  for (const ix in _database) {
    const db = _database[ix]
    if (db.enabled) {
      return db;
    }
  }

  throw('No database cofigured!')
};

// Gets the configuared data sink, defaults to filesystem
const getAuthentication = () => {
  if (userSettings !== null && userSettings.sink) {
    _authentication = userSettings.authentication;
  }
  for (const ix in _authentication) {
    const auth = _authentication[ix]
    if (auth.enabled) {
      return auth;
    }
  }

  throw('No database cofigured!')
};

// Log configuration to console
const logConfiguration = () => {
  console.log(`authorisedList = ${JSON.stringify(getAuthorisedList())}`);
  console.log(`data sink = ${JSON.stringify(getDatabase())}`);
  console.log(`authentication = ${JSON.stringify(getAuthentication())}`);
}

logConfiguration();

exports.getAuthorisedList = getAuthorisedList;
exports.getDatabase = getDatabase;
exports.logConfiguration = logConfiguration;
exports.getAuthentication = getAuthentication;
