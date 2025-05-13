import { readFileSync } from 'fs';
import { join } from 'path';
import { ConfigSchema, type Config } from '../../proxy.config.schema';

export let configFile: string = join(process.cwd(), 'config.proxy.json');
export let config: Config;

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
 * Loads and validates the configuration file using Zod.
 * If validation succeeds, the parsed config is stored in the exported `config`.
 *
 * @return {Config} The validated and default-filled configuration object.
 * @throws {ZodError} If validation fails.
 */
export function loadConfig(): Config {
  const raw = JSON.parse(readFileSync(configFile, 'utf-8'));
  const parsed = ConfigSchema.parse(raw);
  config = parsed;
  return parsed;
}

/**
 * Validates a configuration file without mutating the exported `config`.
 *
 * @param {string} [filePath=configFile] - Path to the configuration file to validate.
 * @return {boolean} Returns `true` if the file passes validation.
 * @throws {ZodError} If validation fails.
 */
export function validate(filePath: string = configFile): boolean {
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  ConfigSchema.parse(raw);
  return true;
}
