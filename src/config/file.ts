import { readFileSync } from 'fs';
import { join } from 'path';
import { validate as jsonSchemaValidate } from 'jsonschema';

export let configFile: string = join(process.cwd(), 'proxy.config.json');

/**
 * Set the config file path.
 * @param {string} file - The path to the config file.
 */
export function setConfigFile(file: string) {
  configFile = file;
}

/**
 * Validate config file.
 * @param {string} configFilePath - The path to the config file.
 * @return {boolean} - Returns true if validation is successful.
 * @throws Will throw an error if the validation fails.
 */
export function validate(configFilePath: string = configFile!): boolean {
  const config = JSON.parse(readFileSync(configFilePath, 'utf-8'));
  const schemaPath = join(process.cwd(), 'config.schema.json');
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  jsonSchemaValidate(config, schema, { required: true, throwError: true });
  return true;
}
