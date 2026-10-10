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

import type { Migration } from './index';
import { normaliseScmLogin } from '../helper';

/**
 * Users created before this migration carried a single free-text `gitAccount`. The only
 * code that ever read it was the GitHub token resolver, so it is carried over
 * as the user's `github` identity. Users that already have `scmIdentities`, or
 * whose `gitAccount` was blank or the seed value 'none', are left alone. The
 * old field is not removed, so the migration is safe to re-run and to roll
 * back.
 */
export const gitAccountToScmIdentities: Migration = {
  id: '20260913-git-account-to-scm-identities',

  up: async (sink) => {
    const users = await sink.getUsers();
    // github handles already linked on users the migration will not touch
    const taken = new Set<string>();
    // normalised legacy handle -> users that carried it
    const claims = new Map<string, string[]>();
    for (const user of users) {
      const hasIdentities = user.scmIdentities && Object.keys(user.scmIdentities).length > 0;
      if (hasIdentities) {
        if (user.scmIdentities.github) taken.add(normaliseScmLogin(user.scmIdentities.github));
        continue;
      }
      const legacy = (user as { gitAccount?: string }).gitAccount;
      if (!legacy) {
        continue;
      }
      const handle = normaliseScmLogin(legacy);
      if (!handle || handle === 'none') {
        continue;
      }
      claims.set(handle, [...(claims.get(handle) ?? []), user.username]);
    }
    for (const [handle, usernames] of claims) {
      // A handle claimed twice cannot identify anyone; link none of the claimants.
      if (usernames.length > 1 || taken.has(handle)) {
        console.warn(
          `gitAccountToScmIdentities: github account '${handle}' is claimed by more than one user ` +
            `(${usernames.join(', ')}${taken.has(handle) ? ', and one already linked' : ''}); none linked`,
        );
        continue;
      }
      await sink.updateUser({
        username: usernames[0],
        scmIdentities: { github: handle },
      });
    }
  },

  down: async (sink) => {
    const users = await sink.getUsers();
    for (const user of users) {
      const legacy = (user as { gitAccount?: string }).gitAccount;
      if (!legacy || user.scmIdentities?.github !== normaliseScmLogin(legacy)) {
        continue;
      }
      const { github: _github, ...rest } = user.scmIdentities;
      await sink.updateUser({ username: user.username, scmIdentities: rest });
    }
  },
};
