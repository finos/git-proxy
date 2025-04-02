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
        return true;
      } catch (err) {
        console.error('Failed to create cache directory:', err);
        return false;
      }
    }
    return true;
  }

  async start() {
    const { configurationSources } = this.config;
    if (!configurationSources?.enabled) {
      return;
    }

    // Clear any existing interval before starting a new one
    if (this.reloadTimer) {
      clearInterval(this.reloadTimer);
      this.reloadTimer = null;
    }

    // Start periodic reload if interval is set
    if (configurationSources.reloadIntervalSeconds > 0) {
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
    if (this.isReloading) return;
    this.isReloading = true;

    try {
      const { configurationSources } = this.config;
      if (!configurationSources?.enabled) return;

      const configs = await Promise.all(
        configurationSources.sources
          .filter((source) => source.enabled)
          .map((source) => this.loadFromSource(source)),
      );

      // Use merge strategy based on configuration
      const shouldMerge = configurationSources.merge ?? true; // Default to true for backward compatibility
      const newConfig = shouldMerge
        ? configs.reduce(
            (acc, curr) => {
              return this.deepMerge(acc, curr);
            },
            { ...this.config },
          )
        : { ...this.config, ...configs[configs.length - 1] }; // Use last config for override

      // Emit change event if config changed
      if (JSON.stringify(newConfig) !== JSON.stringify(this.config)) {
        this.config = newConfig;
        this.emit('configurationChanged', this.config);
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
    const content = await fs.promises.readFile(configPath, 'utf8');
    return JSON.parse(content);
  }

  async loadFromHttp(source) {
    const headers = {
      ...source.headers,
      ...(source.auth?.type === 'bearer' ? { Authorization: `Bearer ${source.auth.token}` } : {}),
    };

    const response = await axios.get(source.url, { headers });
    return response.data;
  }

  async loadFromGit(source) {
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
    await fs.promises.mkdir(tempDir, { recursive: true });

    const repoDir = path.join(tempDir, Buffer.from(source.repository).toString('base64'));
    if (!isValidPath(repoDir)) {
      throw new Error('Invalid repository directory path');
    }

    // Clone or pull repository
    if (!fs.existsSync(repoDir)) {
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
      await execFileAsync('git', ['clone', source.repository, repoDir], execOptions);
    } else {
      await execFileAsync('git', ['pull'], { cwd: repoDir });
    }

    // Checkout specific branch if specified
    if (source.branch) {
      await execFileAsync('git', ['checkout', source.branch], { cwd: repoDir });
    }

    // Read and parse config file
    const configPath = path.join(repoDir, source.path);
    if (!isValidPath(configPath)) {
      throw new Error('Invalid configuration file path in repository');
    }
    const content = await fs.promises.readFile(configPath, 'utf8');
    return JSON.parse(content);
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

function isObject(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

module.exports = ConfigLoader;
module.exports.isValidGitUrl = isValidGitUrl;
module.exports.isValidPath = isValidPath;
module.exports.isValidBranchName = isValidBranchName;
