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

import { Repo, RepoQuery } from '../types';
import { query } from './helper';

interface RepoRow {
  _id: string;
  project: string;
  name: string;
  url: string;
  can_push: string[] | null;
  can_authorise: string[] | null;
}

const rowToRepo = (row: RepoRow): Repo =>
  new Repo(
    row.project,
    row.name,
    row.url,
    {
      canPush: row.can_push ?? [],
      canAuthorise: row.can_authorise ?? [],
    },
    row._id,
  );

// Reconstruct the `canPush` / `canAuthorise` arrays from the normalised
// repo_users join table. `ORDER BY` keeps the arrays deterministic, and the
// `coalesce(..., '{}')` makes a repo with no members come back as empty arrays
// rather than null — preserving the empty-array invariant from issue #1497.
const SELECT_REPOS = `
  SELECT r._id, r.project, r.name, r.url,
    coalesce(
      array_agg(ru.username ORDER BY ru.username) FILTER (WHERE ru.role = 'canPush'),
      '{}'
    ) AS can_push,
    coalesce(
      array_agg(ru.username ORDER BY ru.username) FILTER (WHERE ru.role = 'canAuthorise'),
      '{}'
    ) AS can_authorise
  FROM repos r
  LEFT JOIN repo_users ru ON ru.repo_id = r._id`;

const GROUP_BY = 'GROUP BY r._id';

export const getRepos = async (q: Partial<RepoQuery> = {}): Promise<Repo[]> => {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (q.name) {
    values.push(q.name.toLowerCase());
    clauses.push(`r.name = $${values.length}`);
  }
  if (q.project !== undefined) {
    values.push(q.project);
    clauses.push(`r.project = $${values.length}`);
  }
  if (q.url) {
    values.push(q.url);
    clauses.push(`r.url = $${values.length}`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query<RepoRow>(`${SELECT_REPOS} ${where} ${GROUP_BY}`, values);
  return result.rows.map(rowToRepo);
};

export const getRepo = async (name: string): Promise<Repo | null> => {
  const result = await query<RepoRow>(`${SELECT_REPOS} WHERE r.name = $1 ${GROUP_BY}`, [
    name.toLowerCase(),
  ]);
  return result.rowCount === 0 ? null : rowToRepo(result.rows[0]);
};

export const getRepoByUrl = async (url: string): Promise<Repo | null> => {
  const result = await query<RepoRow>(`${SELECT_REPOS} WHERE r.url = $1 ${GROUP_BY}`, [url]);
  return result.rowCount === 0 ? null : rowToRepo(result.rows[0]);
};

export const getRepoById = async (_id: string): Promise<Repo | null> => {
  const result = await query<RepoRow>(`${SELECT_REPOS} WHERE r._id = $1 ${GROUP_BY}`, [_id]);
  return result.rowCount === 0 ? null : rowToRepo(result.rows[0]);
};

const addUserToRole = async (
  _id: string,
  user: string,
  role: 'canPush' | 'canAuthorise',
): Promise<void> => {
  await query(
    `INSERT INTO repo_users (repo_id, username, role)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [_id, user.toLowerCase(), role],
  );
};

const removeUserFromRole = async (
  _id: string,
  user: string,
  role: 'canPush' | 'canAuthorise',
): Promise<void> => {
  await query(`DELETE FROM repo_users WHERE repo_id = $1 AND username = $2 AND role = $3`, [
    _id,
    user.toLowerCase(),
    role,
  ]);
};

export const createRepo = async (repo: Repo): Promise<Repo> => {
  const users = repo.users ?? { canPush: [], canAuthorise: [] };
  const result = await query<{ _id: string }>(
    `INSERT INTO repos (project, name, url)
     VALUES ($1, $2, $3)
     RETURNING _id`,
    [repo.project ?? '', repo.name, repo.url],
  );
  const _id = result.rows[0]._id;

  // Persist any permissions supplied at creation into the join table.
  for (const username of users.canPush ?? []) {
    await addUserToRole(_id, username, 'canPush');
  }
  for (const username of users.canAuthorise ?? []) {
    await addUserToRole(_id, username, 'canAuthorise');
  }

  repo._id = _id;
  repo.users = users;
  return repo;
};

export const addUserCanPush = (_id: string, user: string): Promise<void> =>
  addUserToRole(_id, user, 'canPush');

export const addUserCanAuthorise = (_id: string, user: string): Promise<void> =>
  addUserToRole(_id, user, 'canAuthorise');

export const removeUserCanPush = (_id: string, user: string): Promise<void> =>
  removeUserFromRole(_id, user, 'canPush');

export const removeUserCanAuthorise = (_id: string, user: string): Promise<void> =>
  removeUserFromRole(_id, user, 'canAuthorise');

export const deleteRepo = async (_id: string): Promise<void> => {
  // repo_users rows are removed by the ON DELETE CASCADE foreign key.
  await query(`DELETE FROM repos WHERE _id = $1`, [_id]);
};
