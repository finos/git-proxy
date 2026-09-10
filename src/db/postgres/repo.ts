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

import { PoolClient } from 'pg';

import { Repo, RepoQuery } from '../types';
import { query, withTransaction } from './helper';

interface RepoRow {
  _id: string;
  project: string;
  name: string;
  url: string;
  can_push: string[] | null;
  can_authorise: string[] | null;
  date_created: string | null;
  last_modified: string | null;
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
    row.date_created ?? undefined,
    row.last_modified ?? undefined,
  );

// Reconstruct the `canPush` / `canAuthorise` arrays from the normalised
// repo_users join table. `ORDER BY` keeps the arrays deterministic, and the
// `coalesce(..., '{}')` makes a repo with no members come back as empty arrays
// rather than null, matching the mongo/NeDB backends.
const SELECT_REPOS = `
  SELECT r._id, r.project, r.name, r.url, r.date_created, r.last_modified,
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
  await query(`UPDATE repos SET last_modified = $2 WHERE _id = $1`, [
    _id,
    new Date().toISOString(),
  ]);
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
  await query(`UPDATE repos SET last_modified = $2 WHERE _id = $1`, [
    _id,
    new Date().toISOString(),
  ]);
};

// Insert one role's usernames as a single statement. Lowercased to match
// addUserToRole; ON CONFLICT collapses duplicates (case-only ones included).
const insertRoleRows = async (
  client: PoolClient,
  _id: string,
  role: 'canPush' | 'canAuthorise',
  usernames: string[],
): Promise<void> => {
  if (usernames.length === 0) return;
  await client.query(
    `INSERT INTO repo_users (repo_id, username, role)
     SELECT $1, lower(u.username), $2 FROM unnest($3::text[]) AS u(username)
     ON CONFLICT DO NOTHING`,
    [_id, role, usernames],
  );
};

export const createRepo = async (repo: Repo): Promise<Repo> => {
  const users = repo.users ?? { canPush: [], canAuthorise: [] };
  const now = new Date().toISOString();
  if (!repo.dateCreated) repo.dateCreated = now;
  if (!repo.lastModified) repo.lastModified = now;

  // One transaction: the repo row and any permissions supplied at creation
  // land together or not at all. A crash partway must not leave a repo behind
  // with empty canPush/canAuthorise, since those arrays gate pushing and
  // approving.
  const _id = await withTransaction(async (client) => {
    const result = await client.query<{ _id: string }>(
      `INSERT INTO repos (project, name, url, date_created, last_modified)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING _id`,
      [repo.project ?? '', repo.name, repo.url, repo.dateCreated, repo.lastModified],
    );
    const newId = result.rows[0]._id;
    await insertRoleRows(client, newId, 'canPush', users.canPush ?? []);
    await insertRoleRows(client, newId, 'canAuthorise', users.canAuthorise ?? []);
    return newId;
  });

  repo._id = _id;
  repo.users = users;
  return repo;
};

/**
 * Apply a partial update to a repo row. Only the supplied fields are written,
 * matching mongo's `$set` / `$unset` behaviour: a field explicitly set to
 * `undefined` is reset to the column default.
 *
 * Permissions live in the `repo_users` join table rather than a column, so a
 * supplied `users` object replaces that repo's rows wholesale.
 */
export const updateRepo = async (repo: Partial<Repo>): Promise<void> => {
  const { _id, users, ...fields } = repo;
  if (!_id) {
    throw new Error('updateRepo requires a repo _id');
  }

  const COLUMNS: Record<string, string> = {
    project: 'project',
    name: 'name',
    url: 'url',
    dateCreated: 'date_created',
    lastModified: 'last_modified',
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(fields)) {
    const column = COLUMNS[key];
    if (!column) continue;
    if (value === undefined) {
      sets.push(`${column} = DEFAULT`);
      continue;
    }
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }

  if (sets.length === 0 && users === undefined) {
    throw new Error('updateRepo requires at least one field to update');
  }

  // One transaction for the whole update: the row change, the permission
  // replacement and the last_modified bump land together or not at all, so a
  // failure partway cannot leave a repo without its roles.
  await withTransaction(async (client) => {
    if (sets.length > 0) {
      await client.query(`UPDATE repos SET ${sets.join(', ')} WHERE _id = $${values.length + 1}`, [
        ...values,
        _id,
      ]);
    }

    if (users !== undefined) {
      await client.query(`DELETE FROM repo_users WHERE repo_id = $1`, [_id]);
      await insertRoleRows(client, _id, 'canPush', users.canPush ?? []);
      await insertRoleRows(client, _id, 'canAuthorise', users.canAuthorise ?? []);
      await client.query(`UPDATE repos SET last_modified = $2 WHERE _id = $1`, [
        _id,
        new Date().toISOString(),
      ]);
    }
  });
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
