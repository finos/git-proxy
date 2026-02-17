import { existsSync, readFileSync } from 'fs';

import defaultSettings from '../../proxy.config.json';
import { GitProxyConfig, Convert } from './generated/config';
import { ConfigLoader } from './ConfigLoader';
import { Configuration } from './types';
import { serverConfig } from './env';
import { getConfigFile } from './file';

// Cache for current configuration
let _currentConfig: GitProxyConfig | null = null;
let _configLoader: ConfigLoader | null = null;

// Function to invalidate cache - useful for testing
export const invalidateCache = () => {
  _currentConfig = null;
};

// Compatibility function for old initUserConfig behavior
export const initUserConfig = () => {
  invalidateCache();
  loadFullConfiguration(); // Force immediate reload
};

// Function to clean undefined values from an object
function cleanUndefinedValues(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefinedValues);

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanUndefinedValues(value);
    }
  }
  return cleaned;
}

/**
 * Load and merge default + user configuration with QuickType validation
 * @return {GitProxyConfig} The merged and validated configuration
 */
function loadFullConfiguration(): GitProxyConfig {
  if (_currentConfig) {
    return _currentConfig;
  }

  const rawDefaultConfig = Convert.toGitProxyConfig(JSON.stringify(defaultSettings));

  // Clean undefined values from defaultConfig
  const defaultConfig = cleanUndefinedValues(rawDefaultConfig);

  let userSettings: Partial<GitProxyConfig> = {};
  const userConfigFile = process.env.CONFIG_FILE || getConfigFile();

  console.log(
    `[CONFIG] Resolving user config: CONFIG_FILE=${process.env.CONFIG_FILE}, getConfigFile()=${getConfigFile()}, resolved=${userConfigFile}`,
  );
  console.log(`[CONFIG] File exists: ${existsSync(userConfigFile)}`);

  if (existsSync(userConfigFile)) {
    try {
      const userConfigContent = readFileSync(userConfigFile, 'utf-8');
      // Parse as JSON first, then clean undefined values
      // Don't use QuickType validation for partial configurations
      const rawUserConfig = JSON.parse(userConfigContent);
      userSettings = cleanUndefinedValues(rawUserConfig);
      console.log(`[CONFIG] Loaded user config with keys: ${Object.keys(userSettings).join(', ')}`);
      if (userSettings.authorisedList) {
        console.log(
          `[CONFIG] authorisedList from user config: ${JSON.stringify(userSettings.authorisedList)}`,
        );
      }
    } catch (error) {
      console.error(`Error loading user config from ${userConfigFile}:`, error);
      throw error;
    }
  } else {
    console.log(`[CONFIG] User config file not found at ${userConfigFile}, using defaults only`);
  }

  _currentConfig = mergeConfigurations(defaultConfig, userSettings);

  return _currentConfig;
}

/**
 * Merge configurations with environment variable overrides
 * @param {GitProxyConfig} defaultConfig - The default configuration
 * @param {Partial<GitProxyConfig>} userSettings - User-provided configuration overrides
 * @return {GitProxyConfig} The merged configuration
 */
function mergeConfigurations(
  defaultConfig: GitProxyConfig,
  userSettings: Partial<GitProxyConfig>,
): GitProxyConfig {
  // Special handling for TLS configuration when legacy fields are used
  let tlsConfig = userSettings.tls || defaultConfig.tls;

  // If user doesn't specify tls but has legacy SSL fields, use only legacy fallback
  if (!userSettings.tls && (userSettings.sslKeyPemPath || userSettings.sslCertPemPath)) {
    tlsConfig = {
      enabled: defaultConfig.tls?.enabled || false,
      // Use empty strings so legacy fallback works
      key: '',
      cert: '',
    };
  }

  return {
    ...defaultConfig,
    ...userSettings,
    // Deep merge for specific objects
    api: userSettings.api ? cleanUndefinedValues(userSettings.api) : defaultConfig.api,
    domains: { ...defaultConfig.domains, ...userSettings.domains },
    commitConfig: { ...defaultConfig.commitConfig, ...userSettings.commitConfig },
    attestationConfig: { ...defaultConfig.attestationConfig, ...userSettings.attestationConfig },
    rateLimit: userSettings.rateLimit || defaultConfig.rateLimit,
    tls: tlsConfig,
    tempPassword: { ...defaultConfig.tempPassword, ...userSettings.tempPassword },
    // Preserve legacy SSL fields
    sslKeyPemPath: userSettings.sslKeyPemPath || defaultConfig.sslKeyPemPath,
    sslCertPemPath: userSettings.sslCertPemPath || defaultConfig.sslCertPemPath,
    // Environment variable overrides
    cookieSecret:
      serverConfig.GIT_PROXY_COOKIE_SECRET ||
      userSettings.cookieSecret ||
      defaultConfig.cookieSecret,
  };
}

// Get configured proxy URL
export const getProxyUrl = (): string | undefined => {
  const config = loadFullConfiguration();
  return config.proxyUrl;
};

// Gets a list of authorised repositories
export const getAuthorisedList = () => {
  const config = loadFullConfiguration();
  return config.authorisedList || [];
};

// Gets a list of authorised repositories
export const getTempPasswordConfig = () => {
  const config = loadFullConfiguration();
  return config.tempPassword;
};

// Gets the configured data sink, defaults to filesystem
export const getDatabase = () => {
  const config = loadFullConfiguration();
  const databases = config.sink || [];

  for (const db of databases) {
    if (db.enabled) {
      // if mongodb is configured and connection string unspecified, fallback to env var
      if (db.type === 'mongo' && !db.connectionString) {
        db.connectionString = serverConfig.GIT_PROXY_MONGO_CONNECTION_STRING;
      }
      return db;
    }
  }

  throw Error('No database configured!');
};

/**
 * Get the list of enabled authentication methods
 *
 * At least one authentication method must be enabled.
 * @return List of enabled authentication methods
 */
export const getAuthMethods = () => {
  const config = loadFullConfiguration();
  const authSources = config.authentication || [];

  const enabledAuthMethods = authSources.filter((auth) => auth.enabled);

  if (enabledAuthMethods.length === 0) {
    throw new Error('No authentication method enabled');
  }

  return enabledAuthMethods;
};

/**
 * Get the list of enabled authentication methods for API endpoints
 *
 * If no API authentication methods are enabled, all endpoints are public.
 * @return List of enabled authentication methods
 */
export const getAPIAuthMethods = () => {
  const config = loadFullConfiguration();
  const apiAuthSources = config.apiAuthentication || [];

  return apiAuthSources.filter((auth: { enabled: any }) => auth.enabled);
};

// Gets the configured authentication method, defaults to local (backward compatibility)
export const getAuthentication = () => {
  const authMethods = getAuthMethods();
  return authMethods[0]; // Return first enabled method for backward compatibility
};

// Log configuration to console
export const logConfiguration = () => {
  console.log(`authorisedList = ${JSON.stringify(getAuthorisedList())}`);
  console.log(`data sink = ${JSON.stringify(getDatabase())}`);
  console.log(`authentication = ${JSON.stringify(getAuthMethods())}`);
  console.log(`rateLimit = ${JSON.stringify(getRateLimit())}`);
};

export const getAPIs = () => {
  const config = loadFullConfiguration();
  return config.api || {};
};

export const getCookieSecret = (): string => {
  const config = loadFullConfiguration();

  if (!config.cookieSecret) {
    throw new Error('cookieSecret is not set!');
  }

  return config.cookieSecret;
};

export const getSessionMaxAgeHours = (): number => {
  const config = loadFullConfiguration();
  return config.sessionMaxAgeHours || 24;
};

// Get commit related configuration
export const getCommitConfig = () => {
  const config = loadFullConfiguration();
  return config.commitConfig || {};
};

// Get attestation related configuration
export const getAttestationConfig = () => {
  const config = loadFullConfiguration();
  return config.attestationConfig || {};
};

// Get private organizations related configuration
export const getPrivateOrganizations = () => {
  const config = loadFullConfiguration();
  return config.privateOrganizations || [];
};

// Get URL shortener
export const getURLShortener = (): string | undefined => {
  const config = loadFullConfiguration();
  return config.urlShortener;
};

// Get contact e-mail address
export const getContactEmail = (): string | undefined => {
  const config = loadFullConfiguration();
  return config.contactEmail;
};

// Get CSRF protection flag
export const getCSRFProtection = (): boolean | undefined => {
  const config = loadFullConfiguration();
  return config.csrfProtection;
};

// Get loadable push plugins
export const getPlugins = () => {
  const config = loadFullConfiguration();
  return config.plugins || [];
};

export const getTLSKeyPemPath = (): string | undefined => {
  const config = loadFullConfiguration();
  return config.tls?.key && config.tls.key !== '' ? config.tls.key : config.sslKeyPemPath;
};

export const getTLSCertPemPath = (): string | undefined => {
  const config = loadFullConfiguration();
  return config.tls?.cert && config.tls.cert !== '' ? config.tls.cert : config.sslCertPemPath;
};

export const getTLSEnabled = (): boolean => {
  const config = loadFullConfiguration();
  return config.tls?.enabled || false;
};

export const getDomains = () => {
  const config = loadFullConfiguration();
  return config.domains || {};
};

export const getUIRouteAuth = () => {
  const config = loadFullConfiguration();
  return config.uiRouteAuth || {};
};

export const getRateLimit = () => {
  const config = loadFullConfiguration();
  return config.rateLimit;
};

// Function to handle configuration updates
const handleConfigUpdate = async (newConfig: Configuration) => {
  console.log('Configuration updated from external source');
  try {
    // 1. Validate new configuration using QuickType
    const validatedConfig = Convert.toGitProxyConfig(JSON.stringify(newConfig));

    // 2. Get proxy module dynamically to avoid circular dependency
    const proxy = require('../proxy');

    // 3. Stop existing services
    await proxy.stop();

    // 4. Update config
    _currentConfig = validatedConfig;

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

// Initialize config loader
function initializeConfigLoader() {
  const config = loadFullConfiguration() as Configuration;
  _configLoader = new ConfigLoader(config);

  // Handle configuration updates
  _configLoader.on('configurationChanged', handleConfigUpdate);

  _configLoader.on('configurationError', (error: Error) => {
    console.error('Error loading external configuration:', error);
  });

  // Start the config loader if external sources are enabled
  _configLoader.start().catch((error: Error) => {
    console.error('Failed to start configuration loader:', error);
  });
}

// Force reload of configuration
export const reloadConfiguration = async () => {
  _currentConfig = null;
  if (_configLoader) {
    await _configLoader.reloadConfiguration();
  }
  loadFullConfiguration();
};

// Initialize configuration on module load
try {
  loadFullConfiguration();
  initializeConfigLoader();
  console.log('Configuration loaded successfully');
} catch (error) {
  console.error('Failed to load configuration:', error);
  throw error;
}
