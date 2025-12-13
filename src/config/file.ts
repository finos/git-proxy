import { readFileSync } from 'fs';
import { join } from 'path';
import { Convert } from './generated/config';

let configFile: string = join(__dirname, '../../proxy.config.json');

/**
 * Sets the path to the configuration file.
 *
 * @param {string} file - The path to the configuration file.
 * @return {void}
 */
export function setConfigFile(file: string) {
  configFile = file;
}

/**
 * Gets the path to the current configuration file.
 *
 * @return {string} file - The path to the configuration file.
 */
export function getConfigFile() {
  return configFile;
}

export function validate(filePath: string = configFile): boolean {
  // Use QuickType to validate the configuration
  const configContent = readFileSync(filePath, 'utf-8');
  Convert.toGitProxyConfig(configContent);
  return true;
}
