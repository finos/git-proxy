import { existsSync, readFileSync } from 'fs';

import defaultSettings from '../../proxy.config.json';
import { GitProxyConfig, Convert } from './config';
import { ConfigLoader, Configuration } from './ConfigLoader';

// Cache for current configuration
let _currentConfig: GitProxyConfig | null = null;
let _configLoader: ConfigLoader | null = null;

/**
 * Load and merge default + user configuration with QuickType validation
 * @return {GitProxyConfig} The merged and validated configuration
 */
function loadFullConfiguration(): GitProxyConfig {
  if (_currentConfig) {
    return _currentConfig;
  }

  const defaultConfig = Convert.toGitProxyConfig(JSON.stringify(defaultSettings));

  let userSettings: Partial<GitProxyConfig> = {};
  const configFile = process.env.CONFIG_FILE || 'proxy.config.json';

  if (existsSync(configFile)) {
    try {
      const userConfigContent = readFileSync(configFile, 'utf-8');
      const userConfig = Convert.toGitProxyConfig(userConfigContent);
      userSettings = userConfig;
    } catch (error) {
      console.error(`Error loading user config from ${configFile}:`, error);
      throw error;
    }
  }

  _currentConfig = mergeConfigurations(defaultConfig, userSettings);

  return _currentConfig;
}

/**
 * Merge configurations
 * @param {GitProxyConfig} defaultConfig - The default configuration
 * @param {Partial<GitProxyConfig>} userSettings - User-provided configuration overrides
 * @return {GitProxyConfig} The merged configuration
 */
function mergeConfigurations(
  defaultConfig: GitProxyConfig,
  userSettings: Partial<GitProxyConfig>,
): GitProxyConfig {
  return {
    ...defaultConfig,
    ...userSettings,
    // Deep merge for specific objects
    api: { ...defaultConfig.api, ...userSettings.api },
    domains: { ...defaultConfig.domains, ...userSettings.domains },
    commitConfig: { ...defaultConfig.commitConfig, ...userSettings.commitConfig },
    attestationConfig: { ...defaultConfig.attestationConfig, ...userSettings.attestationConfig },
    rateLimit: userSettings.rateLimit || defaultConfig.rateLimit,
    tls: userSettings.tls || defaultConfig.tls,
    tempPassword: { ...defaultConfig.tempPassword, ...userSettings.tempPassword },
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
      return db;
    }
  }

  throw Error('No database cofigured!');
};

// Gets the configured authentication method, defaults to local
export const getAuthentication = () => {
  const config = loadFullConfiguration();
  const authSources = config.authentication || [];

  for (const auth of authSources) {
    if (auth.enabled) {
      return auth;
    }
  }

  throw Error('No authentication cofigured!');
};

// Log configuration to console
export const logConfiguration = () => {
  console.log(`authorisedList = ${JSON.stringify(getAuthorisedList())}`);
  console.log(`data sink = ${JSON.stringify(getDatabase())}`);
  console.log(`authentication = ${JSON.stringify(getAuthentication())}`);
  console.log(`rateLimit = ${JSON.stringify(getRateLimit())}`);
};

export const getAPIs = () => {
  const config = loadFullConfiguration();
  return config.api || {};
};

export const getCookieSecret = (): string | undefined => {
  const config = loadFullConfiguration();
  return config.cookieSecret;
};

export const getSessionMaxAgeHours = (): number | undefined => {
  const config = loadFullConfiguration();
  return config.sessionMaxAgeHours;
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
  return config.tls?.key;
};

export const getTLSCertPemPath = (): string | undefined => {
  const config = loadFullConfiguration();
  return config.tls?.cert;
};

export const getTLSEnabled = (): boolean => {
  const config = loadFullConfiguration();
  return config.tls?.enabled || false;
};

export const getDomains = () => {
  const config = loadFullConfiguration();
  return config.domains || {};
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
