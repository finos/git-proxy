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

import fs from 'fs';
import path from 'path';

import { Action, Step } from '../../actions';
import { CloneResult, RemoteAccess } from './PullRemoteBase';
import { cacheManager } from './cache-manager';
import { PerformanceTimer } from './metrics';
import * as gitOps from './git-operations';

/**
 * Clone for a push using the bare repository cache.
 *
 * Two phases:
 *   1. a persistent bare mirror per repository, shared across pushes, which is
 *      fetched when present and cloned when missing
 *   2. an isolated working copy for this push, cloned locally from that mirror
 *
 * Only phase 1 talks to the remote. Phase 2 is a local clone and is identical for
 * HTTPS and SSH.
 *
 *
 * @param action The push action being processed
 * @param step The pullRemote step, used for logging
 * @param access How to reach the remote for this protocol
 * @param strategy The auth strategy to record on the action
 * @return The clone result for the surrounding step
 */
export async function performCachedClone(
  action: Action,
  step: Step,
  access: RemoteAccess,
  strategy: Action['pullAuthStrategy'],
): Promise<CloneResult> {
  const timer = new PerformanceTimer(step);
  const { repoCacheDir } = cacheManager.getConfig();
  const cacheKey = cacheKeyFor(action);
  const bareRepo = path.join(repoCacheDir, cacheKey);
  const workCopy = path.join(action.proxyGitPath!, action.repoName);

  const bareExisted = fs.existsSync(bareRepo);
  step.log(`Bare cache: ${bareExisted ? 'HIT' : 'MISS'} (${bareRepo})`);
  timer.start(bareExisted ? 'Cached clone (fetch + local clone)' : 'Cached clone (bare + local)');

  await fs.promises.mkdir(repoCacheDir, { recursive: true, mode: 0o755 });

  // Phase 1
  if (bareExisted) {
    try {
      await gitOps.fetch({
        dir: bareRepo,
        url: access.url,
        username: access.username,
        password: access.password,
        env: access.env,
        bare: true,
        prune: true,
      });
      timer.mark('Bare mirror fetched');
    } catch (fetchError) {
      // A corrupted or half-written mirror must not poison every later push,
      // so fall back to rebuilding it from scratch.
      step.log(`Fetch failed, rebuilding bare mirror: ${fetchError}`);
      await fs.promises.rm(bareRepo, { recursive: true, force: true });
      await cloneBare(bareRepo, access);
      timer.mark('Bare mirror rebuilt');
    }
  } else {
    await cloneBare(bareRepo, access);
    timer.mark('Bare mirror created');
  }

  await cacheManager.touchRepository(cacheKey);

  // Phase 2
  await gitOps.cloneLocal({ sourceDir: bareRepo, targetDir: workCopy });
  timer.mark('Working copy created');
  timer.end();

  // LRU eviction runs after the push has what it needs, so a full cache never delays the clone itself.
  const eviction = await cacheManager.enforceLimits();
  if (eviction.removedRepos.length > 0) {
    const freedMB = (eviction.freedBytes / (1024 * 1024)).toFixed(2);
    step.log(`LRU evicted ${eviction.removedRepos.length} bare repos, freed ${freedMB}MB`);
  }

  return {
    command: bareExisted
      ? `git fetch (cached) + git clone ${bareRepo}`
      : `git clone --bare ${access.url} + git clone ${bareRepo}`,
    strategy,
  };
}

/**
 * Build the cache directory name for an action.
 *
 * Without the project, finos/git-proxy and acme/git-proxy would share a mirror.
 * One flat name, not nested folders: eviction only looks one level deep.
 *
 * @param action The push action being processed
 * @return A filesystem-safe, collision-free cache directory name
 */
export function cacheKeyFor(action: Action): string {
  const sanitise = (value: string) => value.replace(/[^\w.-]+/g, '-');
  const name = sanitise(action.repoName);
  return action.project ? `${sanitise(action.project)}__${name}` : name;
}

/**
 * Clone the remote into the cache as a bare mirror.
 *
 * @param bareRepo Destination path inside the cache
 * @param access How to reach the remote
 */
async function cloneBare(bareRepo: string, access: RemoteAccess): Promise<void> {
  await gitOps.clone({
    dir: bareRepo,
    url: access.url,
    username: access.username,
    password: access.password,
    env: access.env,
    bare: true,
  });
}
