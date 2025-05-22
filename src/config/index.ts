import { existsSync, readFileSync } from 'fs';

import defaultSettings from '../../proxy.config.json';
import { configFile, validate } from './file';
import { ConfigLoader, Configuration } from './ConfigLoader';
import {
  Authentication,
  AuthorisedRepo,
  Database,
  RateLimitConfig,
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
let _rateLimit: RateLimitConfig = defaultSettings.rateLimit;

// These are not always present in the default config file, so casting is required
let _tlsEnabled = defaultSettings.tls.enabled;
let _tlsKeyPemPath = defaultSettings.tls.key;
let _tlsCertPemPath = defaultSettings.tls.cert;

// Initialize configuration with defaults and user settings
let _config = { ...defaultSettings, ...(_userSettings || {}) } as Configuration;

// Create config loader instance
const configLoader = new ConfigLoader(_config);

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

  throw Error('No database configured!');
};

// Gets the configured authentication method, defaults to local
export const getAuthentication = () => {
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

  throw Error('No authentication configured!');
};

// Log configuration to console
export const logConfiguration = () => {
  console.log(`authorisedList = ${JSON.stringify(getAuthorisedList())}`);
  console.log(`data sink = ${JSON.stringify(getDatabase())}`);
  console.log(`authentication = ${JSON.stringify(getAuthentication())}`);
  console.log(`rateLimit = ${JSON.stringify(getRateLimit())}`);
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

export const getRateLimit = () => {
  if (_userSettings && _userSettings.rateLimit) {
    _rateLimit = _userSettings.rateLimit;
  }
  return _rateLimit;
};

// Function to handle configuration updates
const handleConfigUpdate = async (newConfig: typeof _config) => {
  console.log('Configuration updated from external source');
  try {
    // 1. Get proxy module dynamically to avoid circular dependency
    const proxy = require('../proxy');

    // 2. Stop existing services
    await proxy.stop();

    // 3. Update config
    _config = newConfig;

    // 4. Validate new configuration
    validate();

    // 5. Restart services with new config
    await proxy.start();

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

// Handle configuration updates
configLoader.on('configurationChanged', handleConfigUpdate);

configLoader.on('configurationError', (error: Error) => {
  console.error('Error loading external configuration:', error);
});

// Start the config loader if external sources are enabled
configLoader.start().catch((error: Error) => {
  console.error('Failed to start configuration loader:', error);
});

// Force reload of configuration
const reloadConfiguration = async () => {
  await configLoader.reloadConfiguration();
};

// Export reloadConfiguration
export { reloadConfiguration };
