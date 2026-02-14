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

import { GitProxyConfig } from './generated/config';

export type ServerConfig = {
  GIT_PROXY_SERVER_PORT: string | number;
  GIT_PROXY_HTTPS_SERVER_PORT: string | number;
  GIT_PROXY_UI_HOST: string;
  GIT_PROXY_UI_PORT: string | number;
  GIT_PROXY_COOKIE_SECRET: string | undefined;
  GIT_PROXY_MONGO_CONNECTION_STRING: string;
};

interface GitAuth {
  type: 'ssh';
  privateKeyPath: string;
}

interface HttpAuth {
  type: 'bearer';
  token: string;
}

interface BaseSource {
  type: 'file' | 'http' | 'git';
  enabled: boolean;
}

export interface FileSource extends BaseSource {
  type: 'file';
  path: string;
}

export interface HttpSource extends BaseSource {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  auth?: HttpAuth;
}

export interface GitSource extends BaseSource {
  type: 'git';
  repository: string;
  branch?: string;
  path: string;
  auth?: GitAuth;
}

export type ConfigurationSource = FileSource | HttpSource | GitSource;

interface ConfigurationSources {
  enabled: boolean;
  sources: ConfigurationSource[];
  reloadIntervalSeconds: number;
  merge?: boolean;
}

export interface Configuration extends GitProxyConfig {
  configurationSources?: ConfigurationSources;
}
