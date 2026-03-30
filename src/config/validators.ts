/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Convert, GitProxyConfig } from './generated/config';
import { getErrorMessage } from '../utils/errors';

const validationChain = [validateCommitConfig];

/**
 * Executes all custom validators on the configuration
 * @param config The configuration to validate
 * @returns true if the configuration is valid, false otherwise
 */
export const validateConfig = (config: GitProxyConfig): boolean => {
  return validationChain.every((validator) => validator(config));
};

/**
 * Validates that commit configuration uses valid regular expressions.
 * @param config The commit configuration to validate
 * @returns true if the commit configuration is valid, false otherwise
 */
function validateCommitConfig(config: GitProxyConfig): boolean {
  return (
    validateConfigRegex(config, 'commitConfig.author.email.local.block') &&
    validateConfigRegex(config, 'commitConfig.author.email.domain.allow') &&
    validateConfigRegex(config, 'commitConfig.message.block.patterns') &&
    validateConfigRegex(config, 'commitConfig.diff.block.patterns') &&
    validateConfigRegex(config, 'commitConfig.diff.block.providers')
  );
}

/**
 * Validates that a regular expression is valid.
 * @param pattern The regular expression to validate
 * @param context The context of the regular expression
 * @returns true if the regular expression is valid, false otherwise
 */
function isValidRegex(pattern: string, context: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    console.error(`Invalid regular expression for ${context}: ${pattern}`);
    return false;
  }
}

/**
 * Validates that a value in the configuration is a valid regular expression.
 * @param config The configuration to validate
 * @param path The path to the value to validate
 * @returns true if the value is a valid regular expression, false otherwise
 */
function validateConfigRegex(config: GitProxyConfig, path: string): boolean {
  const getValueAtPath = (obj: unknown, path: string): unknown => {
    return path.split('.').reduce((current, key) => {
      if (current == null || typeof current !== 'object') {
        return undefined;
      }
      return (current as Record<string, unknown>)[key];
    }, obj);
  };

  const value = getValueAtPath(config, path);

  if (!value) return true;

  if (typeof value === 'string') {
    return isValidRegex(value, path);
  }

  if (Array.isArray(value)) {
    for (const pattern of value) {
      if (!isValidRegex(pattern, path)) return false;
    }
    return true;
  }

  if (typeof value === 'object') {
    return Object.values(value).every((pattern) => isValidRegex(pattern as string, path));
  }

  return true;
}

/**
 * Loads and parses a GitProxyConfig object from a given context and loading strategy.
 * @param context The context of the configuration
 * @param loader The loading strategy to use
 * @returns The parsed GitProxyConfig object
 */
export async function loadConfig(
  context: string,
  loader: () => Promise<string>,
): Promise<GitProxyConfig> {
  const raw = await loader();
  return parseGitProxyConfig(raw, context);
}

/**
 * Parses a raw string into a GitProxyConfig object.
 * @param raw The raw string to parse
 * @param context The context of the configuration
 * @returns The parsed GitProxyConfig object
 */
function parseGitProxyConfig(raw: string, context: string): GitProxyConfig {
  try {
    return Convert.toGitProxyConfig(raw);
  } catch (error: unknown) {
    throw new Error(`Invalid configuration format in ${context}: ${getErrorMessage(error)}`);
  }
}
