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

import { pub } from '../base';
import { guarded } from '../middleware';
import { authRouter } from './auth';
import { configRouter } from './config';
import { healthcheckRouter } from './healthcheck';
import { homeRouter } from './home';
import { pushRouter } from './push';
import { repoRouter } from './repo';
import { usersRouter } from './users';

/**
 * The service API. Each router keeps the mount point its Express predecessor
 * had; push, repo and user sit behind the JWT and password-change guards.
 */
export const apiRouter = {
  home: pub.prefix('/api').tag('Home').router(homeRouter),
  auth: pub.prefix('/api/auth').tag('Auth').router(authRouter),
  healthcheck: pub.prefix('/api/v1/healthcheck').tag('Healthcheck').router(healthcheckRouter),
  push: guarded.prefix('/api/v1/push').tag('Push').router(pushRouter),
  repo: guarded.prefix('/api/v1/repo').tag('Repo').router(repoRouter),
  user: guarded.prefix('/api/v1/user').tag('User').router(usersRouter),
  config: pub.prefix('/api/v1/config').tag('Config').router(configRouter),
};

export type ApiRouter = typeof apiRouter;
