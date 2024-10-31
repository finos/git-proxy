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
let _proxyUrl = defaultSettings.proxyUrl;
let _api = defaultSettings.api;
let _cookieSecret = defaultSettings.cookieSecret;
let _sessionMaxAgeHours = defaultSettings.sessionMaxAgeHours;
let _sslKeyPath = defaultSettings.sslKeyPemPath;
let _sslCertPath = defaultSettings.sslCertPemPath;
let _plugins = defaultSettings.plugins;
let _commitConfig = defaultSettings.commitConfig;
let _attestationConfig = defaultSettings.attestationConfig;
let _privateOrganizations = defaultSettings.privateOrganizations;
let _urlShortener = defaultSettings.urlShortener;
let _contactEmail = defaultSettings.contactEmail;
let _csrfProtection = defaultSettings.csrfProtection;
let _domains = defaultSettings.domains;

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
  console.log(`authorisedList = ${JSON.stringify(getAuthorisedList())}`);
  console.log(`data sink = ${JSON.stringify(getDatabase())}`);
  console.log(`authentication = ${JSON.stringify(getAuthentication())}`);
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
  if (_userSettings && _userSettings.commitConfig) {
    _commitConfig = _userSettings.commitConfig;
  }
  return _commitConfig;
};

// Get attestation related configuration
const getAttestationConfig = () => {
  if (_userSettings && _userSettings.attestationConfig) {
    _attestationConfig = _userSettings.attestationConfig;
  }
  return _attestationConfig;
};

// Get private organizations related configuration
const getPrivateOrganizations = () => {
  if (_userSettings && _userSettings.privateOrganizations) {
    _privateOrganizations = _userSettings.privateOrganizations;
  }
  return _privateOrganizations;
};

// Get URL shortener
const getURLShortener = () => {
  if (_userSettings && _userSettings.urlShortener) {
    _urlShortener = _userSettings.urlShortener;
  }
  return _urlShortener;
};

// Get contact e-mail address
const getContactEmail = () => {
  if (_userSettings && _userSettings.contactEmail) {
    _contactEmail = _userSettings.contactEmail;
  }
  return _contactEmail;
};

// Get CSRF protection flag
const getCSRFProtection = () => {
  if (_userSettings && _userSettings.csrfProtection) {
    _csrfProtection = _userSettings.csrfProtection;
  }
  return _csrfProtection;
};

// Get loadable push plugins
const getPlugins = () => {
  if (_userSettings && _userSettings.plugins) {
    _plugins = _userSettings.plugins;
  }
  return _plugins;
}

const getSSLKeyPath = () => {
  if (_userSettings && _userSettings.sslKeyPemPath) {
    _sslKeyPath = _userSettings.sslKeyPemPath;
  }
  if (!_sslKeyPath) {
    return '../../certs/key.pem';
  }
  return _sslKeyPath;
};

const getSSLCertPath = () => {
  if (_userSettings && _userSettings.sslCertPemPath) {
    _sslCertPath = _userSettings.sslCertPemPath;
  }
  if (!_sslCertPath) {
    return '../../certs/cert.pem';
  }
  return _sslCertPath;
};

const getDomains = () => {
  if (_userSettings && _userSettings.domains) {
    _domains = _userSettings.domains;
  }
  return _domains;
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
exports.getPlugins = getPlugins;
exports.getSSLKeyPath = getSSLKeyPath;
exports.getSSLCertPath = getSSLCertPath;
exports.getDomains = getDomains;
