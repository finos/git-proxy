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

function normalizeUsername(v) {
  return (v || '').toString().trim().toLowerCase();
}

function collectAclOrphans(repos, usernameSet) {
  const orphans = [];

  for (const repo of repos) {
    const repoId = repo._id?.toString?.() ?? String(repo._id ?? '');
    const repoName = repo.name ?? '';
    const repoUrl = repo.url ?? '';
    const usersObj = repo.users ?? {};

    for (const field of ['canPush', 'canAuthorise']) {
      const list = Array.isArray(usersObj[field]) ? usersObj[field] : [];
      for (let i = 0; i < list.length; i++) {
        const raw = list[i];
        if (typeof raw !== 'string') continue;
        const entry = normalizeUsername(raw);
        if (!entry) continue;

        if (!usernameSet.has(entry)) {
          orphans.push({
            repoId,
            repoName,
            repoUrl,
            field,
            orphanUsername: raw,
            normalizedOrphan: entry,
            index: i,
          });
        }
      }
    }
  }

  return orphans;
}

async function analyzeAclWithDatastore(datastore) {
  console.log('\n=== ACL AUDIT PHASE ===');

  const users = await datastore.listUsers();
  const usernameSet = new Set(users.map((u) => normalizeUsername(u.username)).filter(Boolean));

  const repos = await datastore.listRepos();
  const orphans = collectAclOrphans(repos, usernameSet);

  const report = {
    totalRepos: repos.length,
    totalUsers: users.length,
    orphanCount: orphans.length,
    orphans,
  };

  console.log(`ACL orphan entries: ${report.orphanCount}`);

  return { report };
}

module.exports = {
  analyzeAclWithDatastore,
  collectAclOrphans,
  normalizeUsername,
};
