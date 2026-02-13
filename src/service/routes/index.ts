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

import express from 'express';
import auth from './auth';
import push from './push';
import home from './home';
import repo from './repo';
import users from './users';
import healthcheck from './healthcheck';
import config from './config';
import { jwtAuthHandler } from '../passport/jwtAuthHandler';

const routes = (proxy: any) => {
  const router = express.Router();
  router.use('/api', home);
  router.use('/api/auth', auth.router);
  router.use('/api/v1/healthcheck', healthcheck);
  router.use('/api/v1/push', jwtAuthHandler(), push);
  router.use('/api/v1/repo', jwtAuthHandler(), repo(proxy));
  router.use('/api/v1/user', jwtAuthHandler(), users);
  router.use('/api/v1/config', config);
  return router;
};

export default routes;
