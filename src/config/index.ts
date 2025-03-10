import { existsSync, readFileSync } from 'fs';
const fs = require('fs');
const ConfigLoader = require('./ConfigLoader');
const { validate } = require('./file'); // Import the validate function

import defaultSettings from '../../proxy.config.json';
import { configFile } from './file';
import { Authentication, AuthorisedRepo, Database, TempPasswordConfig, UserSettings } from './types';


let _userSettings: UserSettings | null = null;
if (existsSync(configFile)) {
  _userSettings = JSON.parse(readFileSync(configFile, 'utf-8'));
}
let _authorisedList: AuthorisedRepo[] = defaultSettings.authorisedList;
let _database: Database[] = defaultSettings.sink;
let _authentication: Authentication[] = defaultSettings.authentication;
let _tempPassword: TempPasswordConfig = defaultSettings.tempPassword;
let _proxyUrl = defaultSettings.proxyUrl;
let _api: Record<string, unknown> = defaultSettings.api;
let _cookieSecret: string = defaultSettings.cookieSecret;
let _sessionMaxAgeHours: number = defaultSettings.sessionMaxAgeHours;
let _plugins: any[] = defaultSettings.plugins;
let _commitConfig: Record<string, any> = defaultSettings.commitConfig;
let _attestationConfig: Record<string, unknown> = defaultSettings.attestationConfig;
let _privateOrganizations: string[] = defaultSettings.privateOrganizations;
let _urlShortener: string = defaultSettings.urlShortener;
let _contactEmail: string = defaultSettings.contactEmail;
let _csrfProtection: boolean = defaultSettings.csrfProtection;
let _domains: Record<string, unknown> = defaultSettings.domains;
// These are not always present in the default config file, so casting is required
let _sslKeyPath: string = (defaultSettings as any).sslKeyPemPath;
let _sslCertPath: string = (defaultSettings as any).sslCertPemPath;

// Get configured proxy URL
export const getProxyUrl = () => {
  if (_userSettings !== null && _userSettings.proxyUrl) {
    _proxyUrl = _userSettings.proxyUrl;
  }
// Initialize configuration with defaults and user settings
let _config = { ...defaultSettings, ...(_userSettings || {}) };

// Create config loader instance
const configLoader = new ConfigLoader(_config);

// Gets a list of authorised repositories
export const getAuthorisedList = () => {
  if (_userSettings !== null && _userSettings.authorisedList) {
    _authorisedList = _userSettings.authorisedList;
  }
  return _authorisedList;
// Helper function to get current config value
const getConfig = (key) => {
  return _config[key];
};

// Gets a list of authorised repositories
export const getTempPasswordConfig = () => {
  if (_userSettings !== null && _userSettings.tempPassword) {
    _tempPassword = _userSettings.tempPassword;
  }

  return _tempPassword;
};

// Gets the configured data sink, defaults to filesystem
export const getDatabase = () => {
  if (_userSettings !== null && _userSettings.sink) {
    _database = _userSettings.sink;
  }
  for (const ix in _database) {
// Update existing getter functions to use the new config object
const getProxyUrl = () => getConfig('proxyUrl');
const getAuthorisedList = () => getConfig('authorisedList');
const getTempPasswordConfig = () => getConfig('tempPassword');
const getDatabase = () => {
  const sinks = getConfig('sink');
  for (const ix in sinks) {
    if (ix) {
      const db = sinks[ix];
      if (db.enabled) {
        return db;
      }
    }
  }
  throw Error('No database configured!');
};

// Gets the configured authentication method, defaults to local
export const getAuthentication = () => {
  if (_userSettings !== null && _userSettings.authentication) {
    _authentication = _userSettings.authentication;
  }
  for (const ix in _authentication) {
const getAuthentication = () => {
  const auths = getConfig('authentication');
  for (const ix in auths) {
    if (!ix) continue;
    const auth = auths[ix];
    if (auth.enabled) {
      return auth;
    }
  }
  throw Error('No authentication configured!');
};

const getAPIs = () => getConfig('api');
const getCookieSecret = () => getConfig('cookieSecret');
const getSessionMaxAgeHours = () => getConfig('sessionMaxAgeHours');
const getCommitConfig = () => getConfig('commitConfig');
const getAttestationConfig = () => getConfig('attestationConfig');
const getPrivateOrganizations = () => getConfig('privateOrganizations');
const getURLShortener = () => getConfig('urlShortener');
const getContactEmail = () => getConfig('contactEmail');
const getCSRFProtection = () => getConfig('csrfProtection');
const getPlugins = () => getConfig('plugins');
const getSSLKeyPath = () => getConfig('sslKeyPemPath') || '../../certs/key.pem';
const getSSLCertPath = () => getConfig('sslCertPemPath') || '../../certs/cert.pem';
const getDomains = () => getConfig('domains');

// Log configuration to console
export const logConfiguration = () => {
  console.log(`authorisedList = ${JSON.stringify(getAuthorisedList())}`);
  console.log(`data sink = ${JSON.stringify(getDatabase())}`);
  console.log(`authentication = ${JSON.stringify(getAuthentication())}`);
};

export const getAPIs = () => {
  if (_userSettings && _userSettings.api) {
    _api = _userSettings.api;
  }
  return _api;
};
// Function to handle configuration updates
const handleConfigUpdate = async (newConfig) => {
  console.log('Configuration updated from external source');
  try {
    // 1. Get proxy module dynamically to avoid circular dependency
    const proxy = require('../proxy');

export const getCookieSecret = () => {
  if (_userSettings && _userSettings.cookieSecret) {
    _cookieSecret = _userSettings.cookieSecret;
  }
  return _cookieSecret;
};
    // 2. Stop existing services
    await proxy.stop();

export const getSessionMaxAgeHours = () => {
  if (_userSettings && _userSettings.sessionMaxAgeHours) {
    _sessionMaxAgeHours = _userSettings.sessionMaxAgeHours;
  }
  return _sessionMaxAgeHours;
};
    // 3. Update config
    _config = newConfig;

// Get commit related configuration
export const getCommitConfig = () => {
  if (_userSettings && _userSettings.commitConfig) {
    _commitConfig = _userSettings.commitConfig;
  }
  return _commitConfig;
};
    // 4. Validate new configuration
    validate();

// Get attestation related configuration
export const getAttestationConfig = () => {
  if (_userSettings && _userSettings.attestationConfig) {
    _attestationConfig = _userSettings.attestationConfig;
  }
  return _attestationConfig;
};
    // 5. Restart services with new config
    await proxy.start();

// Get private organizations related configuration
export const getPrivateOrganizations = () => {
  if (_userSettings && _userSettings.privateOrganizations) {
    _privateOrganizations = _userSettings.privateOrganizations;
    console.log('Services restarted with new configuration');
  } catch (error) {
    console.error('Failed to apply new configuration:', error);
    // Attempt to restart with previous config
    try {
      const proxy = require('../proxy');
      await proxy.start();
    } catch (startError) {
      console.error('Failed to restart services:', startError);
    }
  }
};

// Get URL shortener
export const getURLShortener = () => {
  if (_userSettings && _userSettings.urlShortener) {
    _urlShortener = _userSettings.urlShortener;
  }
  return _urlShortener;
};
// Handle configuration updates
configLoader.on('configurationChanged', handleConfigUpdate);

// Get contact e-mail address
export const getContactEmail = () => {
  if (_userSettings && _userSettings.contactEmail) {
    _contactEmail = _userSettings.contactEmail;
  }
  return _contactEmail;
};
configLoader.on('configurationError', (error) => {
  console.error('Error loading external configuration:', error);
});

// Get CSRF protection flag
export const getCSRFProtection = () => {
  if (_userSettings && _userSettings.csrfProtection) {
    _csrfProtection = _userSettings.csrfProtection;
  }
  return _csrfProtection;
};
// Start the config loader if external sources are enabled
configLoader.start().catch((error) => {
  console.error('Failed to start configuration loader:', error);
});

// Get loadable push plugins
export const getPlugins = () => {
  if (_userSettings && _userSettings.plugins) {
    _plugins = _userSettings.plugins;
  }
  return _plugins;
}

export const getSSLKeyPath = () => {
  if (_userSettings && _userSettings.sslKeyPemPath) {
    _sslKeyPath = _userSettings.sslKeyPemPath;
  }
  if (!_sslKeyPath) {
    return '../../certs/key.pem';
  }
  return _sslKeyPath;
// Force reload of configuration
const reloadConfiguration = async () => {
  await configLoader.reloadConfiguration();
};

export const getSSLCertPath = () => {
  if (_userSettings && _userSettings.sslCertPemPath) {
    _sslCertPath = _userSettings.sslCertPemPath;
  }
  if (!_sslCertPath) {
    return '../../certs/cert.pem';
  }
  return _sslCertPath;
};

export const getDomains = () => {
  if (_userSettings && _userSettings.domains) {
    _domains = _userSettings.domains;
  }
  return _domains;
};

// Export all the functions
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
exports.reloadConfiguration = reloadConfiguration;
