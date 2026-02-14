/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

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
