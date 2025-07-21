import { readFileSync } from 'fs';
import { join } from 'path';
import { Convert } from './generated/config';

export let configFile: string = join(process.cwd(), 'proxy.config.json');

/**
 * Sets the path to the configuration file.
 *
 * @param {string} file - The path to the configuration file.
 * @return {void}
 */
export function setConfigFile(file: string) {
  configFile = file;
}

export function validate(filePath: string = configFile): boolean {
  // Use QuickType to validate the configuration
  const configContent = readFileSync(filePath, 'utf-8');
  Convert.toGitProxyConfig(configContent);
  return true;
}
