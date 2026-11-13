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

import crypto from 'crypto';
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

  await fs.promises.mkdir(repoCacheDir, { recursive: true, mode: 0o755 });

  // Concurrent pushes to the same repository wait here, so the mirror is never
  // fetched, rebuilt or evicted while another push is reading from it.
  const bareExisted = await cacheManager.withRepositoryLock(cacheKey, async () => {
    const existed = fs.existsSync(bareRepo);
    step.log(`Bare cache: ${existed ? 'HIT' : 'MISS'} (${bareRepo})`);
    timer.start(existed ? 'Cached clone (fetch + local clone)' : 'Cached clone (bare + local)');

    // Phase 1
    if (existed) {
      try {
        await gitOps.fetch({
          dir: bareRepo,
          url: access.url,
          username: access.username,
          password: access.password,
          env: access.env,
          prune: true,
        });
        timer.mark('Bare mirror fetched');
      } catch (fetchError) {
        // A corrupted or half-written mirror must not poison every later push,
        // so try rebuilding it. If the rebuild fails too (e.g. bad credentials)
        // the existing mirror is left untouched for other users.
        step.log(`Fetch failed, rebuilding bare mirror: ${fetchError}`);
        await buildBare(bareRepo, access);
        timer.mark('Bare mirror rebuilt');
      }
    } else {
      await buildBare(bareRepo, access);
      timer.mark('Bare mirror created');
    }

    await cacheManager.touchRepository(cacheKey);

    // Phase 2
    await gitOps.cloneLocal({ sourceDir: bareRepo, targetDir: workCopy });
    timer.mark('Working copy created');
    timer.end();

    return existed;
  });

  // LRU eviction runs after the push has what it needs, so a full cache never delays the clone itself.
  // The mirror just used is the most recent one and is kept, otherwise a repository larger than
  // the whole cache would be thrown away (and fully re-cloned) on every single push.
  const eviction = await cacheManager.enforceLimits([cacheKey]);
  if (eviction.removedRepos.length > 0) {
    const freedMB = (eviction.freedBytes / (1024 * 1024)).toFixed(2);
    step.log(`LRU evicted ${eviction.removedRepos.length} bare repos, freed ${freedMB}MB`);
  }

  const { maxSizeGB } = cacheManager.getConfig();
  if (eviction.remainingBytes > maxSizeGB * 1024 * 1024 * 1024) {
    const remainingMB = (eviction.remainingBytes / (1024 * 1024)).toFixed(2);
    step.log(
      `Warning: bare cache holds ${remainingMB}MB, above cache.maxSizeGB=${maxSizeGB}, ` +
        `because mirrors in use are never evicted; consider raising the limit`,
    );
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
 * Without the host and project, github.com/finos/git-proxy, gitlab.com/finos/git-proxy
 * and github.com/acme/git-proxy would all share a mirror.
 * One flat name, not nested folders: eviction only looks one level deep.
 *
 * @param action The push action being processed
 * @return A filesystem-safe, collision-free cache directory name
 */
export function cacheKeyFor(action: Action): string {
  const sanitise = (value: string) => value.replace(/[^\w.-]+/g, '-');
  return [hostOf(action.url), action.project, action.repoName]
    .filter(Boolean)
    .map(sanitise)
    .join('__');
}

/**
 * Extract the host (with port, if any) from the action URL.
 *
 * @param url The upstream repository URL
 * @return The host, or an empty string when the URL cannot be parsed
 */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/**
 * Clone the remote into a staging folder and only then swap it into the cache,
 * so a failed clone never destroys the mirror that is already there.
 *
 * @param bareRepo Destination path inside the cache
 * @param access How to reach the remote
 */
async function buildBare(bareRepo: string, access: RemoteAccess): Promise<void> {
  // Dot-prefixed so getCacheStats() and eviction ignore it while it is built
  const staging = path.join(
    path.dirname(bareRepo),
    `.staging-${path.basename(bareRepo)}-${crypto.randomUUID()}`,
  );

  try {
    await gitOps.clone({
      dir: staging,
      url: access.url,
      username: access.username,
      password: access.password,
      env: access.env,
      bare: true,
    });
    await fs.promises.rm(bareRepo, { recursive: true, force: true });
    await fs.promises.rename(staging, bareRepo);
  } finally {
    await fs.promises.rm(staging, { recursive: true, force: true });
  }
}
