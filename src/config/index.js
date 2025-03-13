const fs = require('fs');
const ConfigLoader = require('./ConfigLoader');
const { validate } = require('./file'); // Import the validate function

const defaultSettings = require('../../proxy.config.json');
const userSettingsPath = require('./file').configFile;

let _userSettings = null;
if (fs.existsSync(userSettingsPath)) {
  _userSettings = JSON.parse(fs.readFileSync(userSettingsPath));
}

// Initialize configuration with defaults and user settings
let _config = { ...defaultSettings, ...(_userSettings || {}) };

// Create config loader instance
const configLoader = new ConfigLoader(_config);

// Helper function to get current config value
const getConfig = (key) => {
  return _config[key];
};

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
const logConfiguration = () => {
  console.log(`authorisedList = ${JSON.stringify(getAuthorisedList())}`);
  console.log(`data sink = ${JSON.stringify(getDatabase())}`);
  console.log(`authentication = ${JSON.stringify(getAuthentication())}`);
};

// Function to handle configuration updates
const handleConfigUpdate = async (newConfig) => {
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

configLoader.on('configurationError', (error) => {
  console.error('Error loading external configuration:', error);
});

// Start the config loader if external sources are enabled
configLoader.start().catch((error) => {
  console.error('Failed to start configuration loader:', error);
});

// Force reload of configuration
const reloadConfiguration = async () => {
  await configLoader.reloadConfiguration();
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
