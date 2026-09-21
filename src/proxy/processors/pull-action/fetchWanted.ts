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

import { Request } from 'express';
import fs from 'fs';
import simpleGit from 'simple-git';

import { Action, Step, PullType } from '../../actions';
import { EMPTY_COMMIT_HASH } from '../../constants';
import { getErrorMessage } from '../../../utils/errors';

/**
 * Pull-chain equivalent of pullRemote.
 *
 * Fetch requests tell us which commits the client is about to receive
 * (`wants`) and which ones it already has (`haves`). Commits are fetched into
 * `.remote/<action.id>` (a temp directory) to allow processors and plugins
 * inspect the tree (or diff between "haves" and "wants") via plain git commands.
 */

const REMOTE_DIR = './.remote';
const FETCH_FILTER = 'blob:none';
const OID_RE = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

/**
 * Negotiation rounds repeat the same wants over HTTP. We want to remember
 * "wants" that already passed so later rounds can skip the check
 *
 * Only successful pulls are recorded. See `rememberRecentFetch` for details
 */
const RECENT_TTL_MS = 5 * 60 * 1000;
const recentFetches = new Map<string, number>();

const unique = (xs: string[]): string[] => [...new Set(xs)];

const roundKey = (url: string | undefined, wants: string[]): string =>
  `${url}|${[...unique(wants)].sort().join(',')}`;

const seenRecently = (key: string): boolean => {
  const now = Date.now();
  for (const [k, t] of recentFetches) {
    if (now - t > RECENT_TTL_MS) recentFetches.delete(k);
  }
  return recentFetches.has(key);
};

export const clearRecentFetches = (): void => recentFetches.clear();

export const rememberRecentFetch = (action: Action): void => {
  const wants = action.pullData?.fetchedWants;
  if (!wants?.length) return;
  recentFetches.set(roundKey(action.url, wants), Date.now());
};

const assertValidOids = (oids: string[], what: string): void => {
  const bad = oids.filter((oid) => !OID_RE.test(oid));
  if (bad.length) {
    // never let client-supplied strings reach the git command line unvalidated
    throw new Error(`Invalid object id(s) in ${what}: ${bad.join(', ')}`);
  }
};

const exec = async (req: Request, action: Action): Promise<Action> => {
  const step = new Step('fetchWanted');

  try {
    const pull = action.pullData;
    if (!pull || pull.command !== PullType.FETCH) {
      step.log('Not a fetch request; nothing to check out.');
      return action;
    }

    const wants = unique(pull.wants);
    const haves = unique(pull.haves);
    if (wants.length === 0) {
      // Normal for a client that is already up to date; git usually doesn't even
      // send a fetch command in that case, only ls-refs.
      step.log('Fetch request has no wants (client up to date); nothing to check out.');
      return action;
    }
    assertValidOids(wants, 'wants');
    assertValidOids(haves, 'haves');

    if (action.protocol === 'ssh') {
      // TODO: reuse PullRemoteSSH's agent-forwarding setup
      step.log('SSH fetch inspection is not supported yet; skipping checkout.');
      return action;
    }
    // file:// is also accepted for tests/local mirrors
    if (!/^(https|file):\/\//.test(action.url ?? '')) {
      throw new Error(`Unsupported repository URL for fetch inspection: ${action.url}`);
    }

    const key = roundKey(action.url, wants);
    if (seenRecently(key)) {
      pull.repeatedRound = true;
      step.log('Same wants were fetched recently (negotiation round); skipping checkout.');
      return action;
    }

    action.proxyGitPath = `${REMOTE_DIR}/${action.id}`;
    if (fs.existsSync(action.proxyGitPath)) {
      throw new Error(
        'The checkout folder already exists - we may be processing a concurrent request for this fetch.',
      );
    }
    await fs.promises.mkdir(REMOTE_DIR, { recursive: true, mode: 0o755 });
    await fs.promises.mkdir(action.proxyGitPath, { recursive: true, mode: 0o700 });

    const git = simpleGit(action.proxyGitPath);
    await git.raw(['init', '--bare', '--quiet']);
    await git.raw(['remote', 'add', 'origin', action.url]);
    // protocol v2: wants are not restricted to advertised refs
    await git.raw(['config', 'protocol.version', '2']);
    await git.raw(['config', 'gc.auto', '0']);

    const auth = req.headers?.authorization;
    if (auth) {
      // stays inside the throwaway repo; removed with it by clearBareClone
      await git.raw(['config', 'http.extraHeader', `Authorization: ${auth}`]);
    }

    const fetchArgs = ['fetch', '--quiet', '--no-tags', '--depth=1'];
    if (FETCH_FILTER) fetchArgs.push(`--filter=${FETCH_FILTER}`);

    await git.raw([...fetchArgs, 'origin', ...wants]);
    step.log(`Fetched ${wants.length} wanted commit(s): ${wants.join(', ')}`);

    // Best-effort: fetch one of the client's haves so plugins can diff have..want.
    // A have may be a local-only commit that upstream doesn't know about.
    let base = EMPTY_COMMIT_HASH;
    for (const have of haves) {
      try {
        await git.raw([...fetchArgs, 'origin', have]);
        base = have;
        step.log(`Fetched base commit ${have} for diffing.`);
        break;
      } catch (e: unknown) {
        step.log(`Could not fetch have ${have} (${getErrorMessage(e)}); trying next.`);
      }
    }
    if (base === EMPTY_COMMIT_HASH && haves.length) {
      step.log('None of the haves exist upstream; plugins should treat this as a full-tree scan.');
    }

    // Mirror the push-chain fields so plugins can share code between chains
    action.setCommit(base, wants[0]);
    pull.fetchedWants = wants;
    pull.base = base;

    step.setContent({ proxyGitPath: action.proxyGitPath, wants, base });
  } catch (error: unknown) {
    step.setError(`Unable to fetch requested commits: ${getErrorMessage(error)}`);
    if (action.proxyGitPath && fs.existsSync(action.proxyGitPath)) {
      fs.rmSync(action.proxyGitPath, { recursive: true, force: true });
      action.proxyGitPath = undefined;
      step.log('.remote checkout removed after failure.');
    }
  } finally {
    action.addStep(step);
  }

  return action;
};

exec.displayName = 'fetchWanted.exec';

export { exec };
