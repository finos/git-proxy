/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
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
