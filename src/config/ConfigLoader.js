const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const EventEmitter = require('events');
const envPaths = require('env-paths');

// Add path validation helper
function isValidPath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;

  // Check for null bytes and other control characters
  if (/[\0]/.test(filePath)) return false;

  try {
    path.resolve(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

// Add URL validation helper
function isValidGitUrl(url) {
  // Allow git://, https://, or ssh:// URLs
  // Also allow scp-style URLs (user@host:path)
  const validUrlPattern =
    /^(git:\/\/|https:\/\/|ssh:\/\/|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}:)/;
  return typeof url === 'string' && validUrlPattern.test(url);
}

// Add branch name validation helper
function isValidBranchName(branch) {
  if (typeof branch !== 'string') return false;

  // Check for consecutive dots
  if (branch.includes('..')) return false;

  // Check other branch name rules
  // Branch names can contain alphanumeric, -, _, /, and .
  // Cannot start with - or .
  // Cannot contain consecutive dots
  // Cannot contain control characters or spaces
  const validBranchPattern = /^[a-zA-Z0-9][a-zA-Z0-9_/.-]*$/;
  return validBranchPattern.test(branch);
}

class ConfigLoader extends EventEmitter {
  constructor(initialConfig) {
    super();
    this.config = initialConfig;
    this.reloadTimer = null;
    this.isReloading = false;
    this.cacheDir = null;
  }

  async initialize() {
    // Get cache directory path
    const paths = envPaths('git-proxy');
    this.cacheDir = paths.cache;

    // Create cache directory if it doesn't exist
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
        console.log(`Created cache directory at ${this.cacheDir}`);
        return true;
      } catch (err) {
        console.error('Failed to create cache directory:', err);
        return false;
      }
    }
    console.log(`Using cache directory at ${this.cacheDir}`);
    return true;
  }

  async start() {
    const { configurationSources } = this.config;
    if (!configurationSources?.enabled) {
      console.log('Configuration sources are disabled');
      return;
    }

    console.log('Configuration sources are enabled');
    console.log(
      `Sources: ${JSON.stringify(configurationSources.sources.filter((s) => s.enabled).map((s) => s.type))}`,
    );

    // Clear any existing interval before starting a new one
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = null;
    }

    // Start periodic reload if interval is set
    if (configurationSources.reloadIntervalSeconds > 0) {
      console.log(
        `Setting reload interval to ${configurationSources.reloadIntervalSeconds} seconds`,
      );
      this.reloadTimer = setInterval(
        () => this.reloadConfiguration(),
        configurationSources.reloadIntervalSeconds * 1000,
      );
    }

    // Do initial load
    await this.reloadConfiguration();
  }

  stop() {
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = null;
    }
  }

  async reloadConfiguration() {
    if (this.isReloading) {
      console.log('Configuration reload already in progress, skipping');
      return;
    }
    this.isReloading = true;
    console.log('Starting configuration reload');

    try {
      const { configurationSources } = this.config;
      if (!configurationSources?.enabled) {
        console.log('Configuration sources are disabled, skipping reload');
        return;
      }

      const enabledSources = configurationSources.sources.filter((source) => source.enabled);
      console.log(`Found ${enabledSources.length} enabled configuration sources`);

      const configs = await Promise.all(
        enabledSources.map(async (source) => {
          try {
            console.log(`Loading configuration from ${source.type} source`);
            return await this.loadFromSource(source);
          } catch (error) {
            console.error(`Error loading from ${source.type} source:`, error.message);
            return null;
          }
        }),
      );

      // Filter out null results from failed loads
      const validConfigs = configs.filter((config) => config !== null);

      if (validConfigs.length === 0) {
        console.log('No valid configurations loaded from any source');
        return;
      }

      // Use merge strategy based on configuration
      const shouldMerge = configurationSources.merge ?? true; // Default to true for backward compatibility
      console.log(`Using ${shouldMerge ? 'merge' : 'override'} strategy for configuration`);

      const newConfig = shouldMerge
        ? validConfigs.reduce(
            (acc, curr) => {
              return this.deepMerge(acc, curr);
            },
            { ...this.config },
          )
        : { ...this.config, ...validConfigs[validConfigs.length - 1] }; // Use last config for override

      // Emit change event if config changed
      if (JSON.stringify(newConfig) !== JSON.stringify(this.config)) {
        console.log('Configuration has changed, updating and emitting change event');
        this.config = newConfig;
        this.emit('configurationChanged', this.config);
      } else {
        console.log('Configuration has not changed, no update needed');
      }
    } catch (error) {
      console.error('Error reloading configuration:', error);
      this.emit('configurationError', error);
    } finally {
      this.isReloading = false;
    }
  }

  async loadFromSource(source) {
    switch (source.type) {
      case 'file':
        return this.loadFromFile(source);
      case 'http':
        return this.loadFromHttp(source);
      case 'git':
        return this.loadFromGit(source);
      default:
        throw new Error(`Unsupported configuration source type: ${source.type}`);
    }
  }

  async loadFromFile(source) {
    const configPath = path.resolve(process.cwd(), source.path);
    if (!isValidPath(configPath)) {
      throw new Error('Invalid configuration file path');
    }
    console.log(`Loading configuration from file: ${configPath}`);
    const content = await fs.promises.readFile(configPath, 'utf8');
    return JSON.parse(content);
  }

  async loadFromHttp(source) {
    console.log(`Loading configuration from HTTP: ${source.url}`);
    const headers = {
      ...source.headers,
      ...(source.auth?.type === 'bearer' ? { Authorization: `Bearer ${source.auth.token}` } : {}),
    };

    const response = await axios.get(source.url, { headers });
    return response.data;
  }

  async loadFromGit(source) {
    console.log(`Loading configuration from Git: ${source.repository}`);

    // Validate inputs
    if (!source.repository || !isValidGitUrl(source.repository)) {
      throw new Error('Invalid repository URL format');
    }
    if (source.branch && !isValidBranchName(source.branch)) {
      throw new Error('Invalid branch name format');
    }

    // Use OS-specific cache directory
    const paths = envPaths('git-proxy', { suffix: '' });
    const tempDir = path.join(paths.cache, 'git-config-cache');

    if (!isValidPath(tempDir)) {
      throw new Error('Invalid temporary directory path');
    }

    console.log(`Creating git cache directory at ${tempDir}`);
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Create a safe directory name from the repository URL
    const repoDirName = Buffer.from(source.repository)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '_');
    const repoDir = path.join(tempDir, repoDirName);

    if (!isValidPath(repoDir)) {
      throw new Error('Invalid repository directory path');
    }

    console.log(`Using repository directory: ${repoDir}`);

    // Clone or pull repository
    if (!fs.existsSync(repoDir)) {
      console.log(`Cloning repository ${source.repository} to ${repoDir}`);
      const execOptions = {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ...(source.auth?.type === 'ssh'
            ? {
                GIT_SSH_COMMAND: `ssh -i ${source.auth.privateKeyPath}`,
              }
            : {}),
        },
      };

      try {
        await execFileAsync('git', ['clone', source.repository, repoDir], execOptions);
        console.log('Repository cloned successfully');
      } catch (error) {
        console.error('Failed to clone repository:', error.message);
        throw new Error(`Failed to clone repository: ${error.message}`);
      }
    } else {
      console.log(`Pulling latest changes from ${source.repository}`);
      try {
        await execFileAsync('git', ['pull'], { cwd: repoDir });
        console.log('Repository pulled successfully');
      } catch (error) {
        console.error('Failed to pull repository:', error.message);
        throw new Error(`Failed to pull repository: ${error.message}`);
      }
    }

    // Checkout specific branch if specified
    if (source.branch) {
      console.log(`Checking out branch: ${source.branch}`);
      try {
        await execFileAsync('git', ['checkout', source.branch], { cwd: repoDir });
        console.log(`Branch ${source.branch} checked out successfully`);
      } catch (error) {
        console.error(`Failed to checkout branch ${source.branch}:`, error.message);
        throw new Error(`Failed to checkout branch ${source.branch}: ${error.message}`);
      }
    }

    // Read and parse config file
    const configPath = path.join(repoDir, source.path);
    if (!isValidPath(configPath)) {
      throw new Error('Invalid configuration file path in repository');
    }

    console.log(`Reading configuration file: ${configPath}`);
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found at ${configPath}`);
    }

    try {
      const content = await fs.promises.readFile(configPath, 'utf8');
      const config = JSON.parse(content);
      console.log('Configuration loaded successfully from Git');
      return config;
    } catch (error) {
      console.error('Failed to read or parse configuration file:', error.message);
      throw new Error(`Failed to read or parse configuration file: ${error.message}`);
    }
  }

  deepMerge(target, source) {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }
}

// Helper function to check if a value is an object
function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

module.exports = ConfigLoader;
module.exports.isValidGitUrl = isValidGitUrl;
module.exports.isValidPath = isValidPath;
module.exports.isValidBranchName = isValidBranchName;
