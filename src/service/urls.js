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
const { GIT_PROXY_SERVER_PORT: PROXY_HTTP_PORT, GIT_PROXY_UI_PORT: UI_PORT } =
  require('../config/env').serverConfig;
const config = require('../config');

module.exports = {
  getProxyURL: (req) => {
    const defaultURL = `${req.protocol}://${req.headers.host}`.replace(
      `:${UI_PORT}`,
      `:${PROXY_HTTP_PORT}`,
    );
    return config.getDomains().proxy ?? defaultURL;
  },
  getServiceUIURL: (req) => {
    const defaultURL = `${req.protocol}://${req.headers.host}`.replace(
      `:${PROXY_HTTP_PORT}`,
      `:${UI_PORT}`,
    );
    return config.getDomains().service ?? defaultURL;
  },
};
