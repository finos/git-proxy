import { existsSync, readFileSync } from 'fs';

import defaultSettings from '../../proxy.config.json';
import { configFile } from './file';
import {
  Authentication,
  AuthorisedRepo,
  Database,
  TempPasswordConfig,
  UserSettings,
} from './types';

let _userSettings: UserSettings | null = null;
if (existsSync(configFile)) {
  _userSettings = JSON.parse(readFileSync(configFile, 'utf-8'));
}

let _authorisedList: AuthorisedRepo[] = defaultSettings.authorisedList;
let _database: Database[] = defaultSettings.sink;
let _authentication: Authentication[] = defaultSettings.authentication;
let _apiAuthentication: Authentication[] = defaultSettings.apiAuthentication;
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
let _tlsEnabled = defaultSettings.tls.enabled;
let _tlsKeyPemPath = defaultSettings.tls.key;
let _tlsCertPemPath = defaultSettings.tls.cert;

// Get configured proxy URL
export const getProxyUrl = () => {
  if (_userSettings !== null && _userSettings.proxyUrl) {
    _proxyUrl = _userSettings.proxyUrl;
  }

  return _proxyUrl;
};

// Gets a list of authorised repositories
export const getAuthorisedList = () => {
  if (_userSettings !== null && _userSettings.authorisedList) {
    _authorisedList = _userSettings.authorisedList;
  }
  return _authorisedList;
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
    if (ix) {
      const db = _database[ix];
      if (db.enabled) {
        return db;
      }
    }
  }

  throw Error('No database cofigured!');
};

/**
 * Get the list of enabled authentication methods
 * @return {Authentication[]} List of enabled authentication methods
 */
export const getAuthMethods = (): Authentication[] => {
  if (_userSettings !== null && _userSettings.authentication) {
    _authentication = _userSettings.authentication;
  }

  const enabledAuthMethods = _authentication.filter(auth => auth.enabled);

  if (enabledAuthMethods.length === 0) {
    throw new Error("No authentication method enabled.");
  }

  return enabledAuthMethods;
};

/**
 * Get the list of enabled authentication methods for API endpoints
 * @return {Authentication[]} List of enabled authentication methods
 */
export const getAPIAuthMethods = (): Authentication[] => {
  if (_userSettings !== null && _userSettings.apiAuthentication) {
    _apiAuthentication = _userSettings.apiAuthentication;
  }

  const enabledAuthMethods = _apiAuthentication.filter(auth => auth.enabled);

  if (enabledAuthMethods.length === 0) {
    throw new Error("No authentication method enabled.");
  }

  return enabledAuthMethods;
};

// Log configuration to console
export const logConfiguration = () => {
  console.log(`authorisedList = ${JSON.stringify(getAuthorisedList())}`);
  console.log(`data sink = ${JSON.stringify(getDatabase())}`);
  console.log(`authentication = ${JSON.stringify(getAuthMethods())}`);
};

export const getAPIs = () => {
  if (_userSettings && _userSettings.api) {
    _api = _userSettings.api;
  }
  return _api;
};

export const getCookieSecret = () => {
  if (_userSettings && _userSettings.cookieSecret) {
    _cookieSecret = _userSettings.cookieSecret;
  }
  return _cookieSecret;
};

export const getSessionMaxAgeHours = () => {
  if (_userSettings && _userSettings.sessionMaxAgeHours) {
    _sessionMaxAgeHours = _userSettings.sessionMaxAgeHours;
  }
  return _sessionMaxAgeHours;
};

// Get commit related configuration
export const getCommitConfig = () => {
  if (_userSettings && _userSettings.commitConfig) {
    _commitConfig = _userSettings.commitConfig;
  }
  return _commitConfig;
};

// Get attestation related configuration
export const getAttestationConfig = () => {
  if (_userSettings && _userSettings.attestationConfig) {
    _attestationConfig = _userSettings.attestationConfig;
  }
  return _attestationConfig;
};

// Get private organizations related configuration
export const getPrivateOrganizations = () => {
  if (_userSettings && _userSettings.privateOrganizations) {
    _privateOrganizations = _userSettings.privateOrganizations;
  }
  return _privateOrganizations;
};

// Get URL shortener
export const getURLShortener = () => {
  if (_userSettings && _userSettings.urlShortener) {
    _urlShortener = _userSettings.urlShortener;
  }
  return _urlShortener;
};

// Get contact e-mail address
export const getContactEmail = () => {
  if (_userSettings && _userSettings.contactEmail) {
    _contactEmail = _userSettings.contactEmail;
  }
  return _contactEmail;
};

// Get CSRF protection flag
export const getCSRFProtection = () => {
  if (_userSettings && _userSettings.csrfProtection) {
    _csrfProtection = _userSettings.csrfProtection;
  }
  return _csrfProtection;
};

// Get loadable push plugins
export const getPlugins = () => {
  if (_userSettings && _userSettings.plugins) {
    _plugins = _userSettings.plugins;
  }
  return _plugins;
};

export const getTLSKeyPemPath = () => {
  if (_userSettings && _userSettings.sslKeyPemPath) {
    console.log(
      'Warning: sslKeyPemPath setting is replaced with tls.key setting in proxy.config.json & will be deprecated in a future release',
    );
    _tlsKeyPemPath = _userSettings.sslKeyPemPath;
  }
  if (_userSettings?.tls && _userSettings?.tls?.key) {
    _tlsKeyPemPath = _userSettings.tls.key;
  }
  return _tlsKeyPemPath;
};

export const getTLSCertPemPath = () => {
  if (_userSettings && _userSettings.sslCertPemPath) {
    console.log(
      'Warning: sslCertPemPath setting is replaced with tls.cert setting in proxy.config.json & will be deprecated in a future release',
    );
    _tlsCertPemPath = _userSettings.sslCertPemPath;
  }
  if (_userSettings?.tls && _userSettings?.tls?.cert) {
    _tlsCertPemPath = _userSettings.tls.cert;
  }
  return _tlsCertPemPath;
};

export const getTLSEnabled = () => {
  if (_userSettings && _userSettings.tls && _userSettings.tls.enabled) {
    _tlsEnabled = _userSettings.tls.enabled;
  }
  return _tlsEnabled;
};

export const getDomains = () => {
  if (_userSettings && _userSettings.domains) {
    _domains = _userSettings.domains;
  }
  return _domains;
};
