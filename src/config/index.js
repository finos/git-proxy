const fs = require('fs');

const defaultSettings = require('../../proxy.config.json');
const { logger } = require('../logging/index');
const userSettingsPath = require('./file').configFile;

let _userSettings = null;
if (fs.existsSync(userSettingsPath)) {
  _userSettings = JSON.parse(fs.readFileSync(userSettingsPath));
}
let _authorisedList = defaultSettings.authorisedList;
let _database = defaultSettings.sink;
let _authentication = defaultSettings.authentication;
let _tempPassword = defaultSettings.tempPassword;
let _proxyUrl = defaultSettings.proxyUrl;
let _api = defaultSettings.api;
let _cookieSecret = defaultSettings.cookieSecret;
let _sessionMaxAgeHours = defaultSettings.sessionMaxAgeHours;
const _commitConfig = defaultSettings.commitConfig;
const _attestationConfig = defaultSettings.attestationConfig;
const _privateOrganizations = defaultSettings.privateOrganizations;
const _urlShortener = defaultSettings.urlShortener;
const _contactEmail = defaultSettings.contactEmail;
const _csrfProtection = defaultSettings.csrfProtection;

// Get configured proxy URL
const getProxyUrl = () => {
  if (_userSettings !== null && _userSettings.proxyUrl) {
    _proxyUrl = _userSettings.proxyUrl;
  }

  return _proxyUrl;
};

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
  logger.info(`authorisedList = ${JSON.stringify(getAuthorisedList())}`);
  logger.info(`data sink = ${JSON.stringify(getDatabase())}`);
  logger.info(`authentication = ${JSON.stringify(getAuthentication())}`);
};

const getAPIs = () => {
  if (_userSettings && _userSettings.api) {
    _api = _userSettings.api;
  }
  return _api;
};

const getCookieSecret = () => {
  if (_userSettings && _userSettings.cookieSecret) {
    _cookieSecret = _userSettings.cookieSecret;
  }
  return _cookieSecret;
};

const getSessionMaxAgeHours = () => {
  if (_userSettings && _userSettings.sessionMaxAgeHours) {
    _sessionMaxAgeHours = _userSettings.sessionMaxAgeHours;
  }
  return _sessionMaxAgeHours;
};

// Get commit related configuration
const getCommitConfig = () => {
  return _commitConfig;
};

// Get attestation related configuration
const getAttestationConfig = () => {
  return _attestationConfig;
};

// Get private organizations related configuration
const getPrivateOrganizations = () => {
  return _privateOrganizations;
};

// Get URL shortener
const getURLShortener = () => {
  return _urlShortener;
};

// Get contact e-mail address
const getContactEmail = () => {
  return _contactEmail;
};

// Get CSRF protection flag
const getCSRFProtection = () => {
  return _csrfProtection;
};

exports.getAPIs = getAPIs;
exports.getProxyUrl = getProxyUrl;
exports.getAuthorisedList = getAuthorisedList;
exports.getDatabase = getDatabase;
exports.logConfiguration = logConfiguration;
exports.getAuthentication = getAuthentication;
exports.getTempPasswordConfig = getTempPasswordConfig;
exports.getCookieSecret = getCookieSecret;
exports.getSessionMaxAgeHours = getSessionMaxAgeHours;
exports.getCommitConfig = getCommitConfig;
exports.getAttestationConfig = getAttestationConfig;
exports.getPrivateOrganizations = getPrivateOrganizations;
exports.getURLShortener = getURLShortener;
exports.getContactEmail = getContactEmail;
exports.getCSRFProtection = getCSRFProtection;
