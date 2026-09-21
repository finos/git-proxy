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
import simpleGit from 'simple-git';

import { Action, Step, PullType } from '../../actions';
import { getErrorMessage } from '../../../utils/errors';

/**
 * Turns `pullData.wants` (object ids) into human-readable ref names by
 * asking upstream for its ref advertisement. Must run after fetchWanted to
 * reuse the throwaway repo's `origin` remote and credentials.
 */
const exec = async (req: Request, action: Action): Promise<Action> => {
  const step = new Step('resolveWants');

  try {
    const pull = action.pullData;
    if (!pull || pull.command !== PullType.FETCH || !action.proxyGitPath) {
      step.log('No checkout to resolve wants against; skipping.');
      return action;
    }

    const resolved = new Map<string, string[]>();
    for (const ref of pull.wantRefs) resolved.set(ref, []);

    const git = simpleGit(action.proxyGitPath);
    const advert = await git.raw(['ls-remote', '--heads', '--tags', 'origin']);
    const shaToRefs = new Map<string, string[]>();
    for (const line of advert.split('\n')) {
      const [sha, ref] = line.trim().split(/\s+/);
      if (!sha || !ref || ref.endsWith('^{}')) continue;
      shaToRefs.set(sha, [...(shaToRefs.get(sha) ?? []), ref]);
    }

    for (const want of pull.fetchedWants ?? pull.wants) {
      const refs = shaToRefs.get(want) ?? [want];
      for (const ref of refs) resolved.set(ref, [...(resolved.get(ref) ?? []), want]);
    }

    pull.wantedRefs = [...resolved.keys()];

    const heads = pull.wantedRefs.filter((r) => r.startsWith('refs/heads/'));
    const tags = pull.wantedRefs.filter((r) => r.startsWith('refs/tags/'));
    if (heads.length === 1) action.branch = heads[0];
    if (tags.length) action.tags = tags;

    step.log(`Requested refs: ${pull.wantedRefs.join(', ')}`);
    step.setContent({ wantedRefs: pull.wantedRefs });
  } catch (error: unknown) {
    // Not fatal: plugins can still work from object ids
    step.log(`Could not resolve wants to refs: ${getErrorMessage(error)}`);
  } finally {
    action.addStep(step);
  }

  return action;
};

exec.displayName = 'resolveWants.exec';

export { exec };
