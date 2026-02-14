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

import { ServerConfig } from './types';

const {
  GIT_PROXY_SERVER_PORT = 8000,
  GIT_PROXY_HTTPS_SERVER_PORT = 8443,
  GIT_PROXY_UI_HOST = 'http://localhost',
  GIT_PROXY_UI_PORT = 8080,
  GIT_PROXY_COOKIE_SECRET,
  GIT_PROXY_MONGO_CONNECTION_STRING = 'mongodb://localhost:27017/git-proxy',
} = process.env;

export const serverConfig: ServerConfig = {
  GIT_PROXY_SERVER_PORT,
  GIT_PROXY_HTTPS_SERVER_PORT,
  GIT_PROXY_UI_HOST,
  GIT_PROXY_UI_PORT,
  GIT_PROXY_COOKIE_SECRET,
  GIT_PROXY_MONGO_CONNECTION_STRING,
};
