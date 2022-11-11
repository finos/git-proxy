/* eslint-disable max-len */
const fs = require('fs');
const resolveToString = require('es6-template-strings/resolve-to-string');
const configLocation = process.env['GIT_PROXY_CONFIG_PATH'];
const userSettingsEnv = process.env['GIT_PROXY_USER-CONFIG_PATH'];
const compile = require('es6-template-strings/compile');

const loadConfig = () => {
  // Load the config as nicely formatted string (and enusre it's JSON)
  const proxySettingsRaw =
    JSON.stringify(JSON.parse(fs.readFileSync(
      configLocation ? configLocation : './resources/config.json')));

      console.log(proxySettingsRaw);

  // Compile the config string
  const compiled = compile(proxySettingsRaw);

  // replace any ${} in the config string with values from process.env
  const x = resolveToString(compiled, process.env);

  return JSON.parse(x);
};

const proxySettings = loadConfig();
let _userSettings = null;
let _authorisedList = proxySettings.authorisedList;
let _database = proxySettings.sink;
let _authentication = proxySettings.authentication;
let _tempPassword = proxySettings.tempPassword;
let _proxyUrl = proxySettings.proxyUrl;
let _allowSelfSignedCert = proxySettings.allowSelfSignedCert;
let _smtpHost = proxySettings.smtpHost;
let _smtpPort = proxySettings.smtpPort;
let _emailNotificationFromAddress = proxySettings.emailNotificationFromAddress;
let _thirdpartyapi = proxySettings.thirdpartyapi;
let _cookieSecret = proxySettings.cookieSecret;
let _sessionMaxAgeHours = proxySettings.sessionMaxAgeHours;

// Gets a list of authorised repositories
const getProxyUrl = () => {
  if (userSettings !== null && userSettings.proxyUrl) {
    _proxyUrl = userSettings.proxyUrl;
  }

  return _proxyUrl;
};

const userSettings = () => {
  const path = userSettingsEnv ? userSettingsEnv : './user-settings.json';
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

const getAllowSelfSignedCert = () => {
  if (userSettings !== null && userSettings.authorisedList) {
    _allowSelfSignedCert = userSettings.allowSelfSignedCert;
  }

  return _allowSelfSignedCert;
};

// Gets a list of authorised repositories
const getTempPasswordConfig = () => {
  if (userSettings !== null && userSettings.tempPassword) {
    _tempPassword = userSettings.tempPassword;
  }

  return _tempPassword;
};

// Gets the configuared data sink, defaults to filesystem
const getDatabase = () => {
  if (userSettings !== null && userSettings.sink) {
    _database = userSettings.database;
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
  if (userSettings !== null && userSettings.sink) {
    _authentication = userSettings.authentication;
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


// Get SMTP host
const getSmtpHost = () => {
  if (userSettings !== null && userSettings.smtpHost) {
    _smtpHost = userSettings.smtpHost;
  }

  return _smtpHost;
};

const getSmtpPort = () => {
  if (userSettings !== null && userSettings.smtpPort) {
    _smtpPort = userSettings.smtpPort;
  }

  return _smtpPort;
};

const getThirdPartyApi = () => {
  if (userSettings !== null && userSettings.authorisedList) {
    _thirdpartyapi = userSettings.thirdpartyapi;
  }

  return _thirdpartyapi;
};

const getCookieSecret = () => {
  if (userSettings !== null && userSettings.cookieSecret) {
    _cookieSecret = userSettings.cookieSecret;
  }

  return _cookieSecret;
};

const getSessionMaxAgeHours = () => {
  if (userSettings !== null && userSettings.sessionMaxAgeHours) {
    _sessionMaxAgeHours = userSettings.sessionMaxAgeHours;
  }

  return _sessionMaxAgeHours;
};

const getEmailNotificationFromAddress = () => {
  if (userSettings !== null && userSettings.emailNotificationFromAddress) {
    _emailNotificationFromAddress = userSettings.emailNotificationFromAddress;
  }

  return _emailNotificationFromAddress;

}

exports.getThirdPartyApi = getThirdPartyApi;
exports.getAllowSelfSignedCert = getAllowSelfSignedCert;
exports.getProxyUrl = getProxyUrl;
exports.getAuthorisedList = getAuthorisedList;
exports.getDatabase = getDatabase;
exports.logConfiguration = logConfiguration;
exports.getAuthentication = getAuthentication;
exports.getTempPasswordConfig = getTempPasswordConfig;
exports.getSmtpHost = getSmtpHost;
exports.getSmtpPort = getSmtpPort;
exports.getCookieSecret = getCookieSecret;
exports.getSessionMaxAgeHours = getSessionMaxAgeHours;
exports.getEmailNotificationFromAddress = getEmailNotificationFromAddress;
