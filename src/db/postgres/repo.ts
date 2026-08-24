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
  users: { canPush: string[]; canAuthorise: string[] } | null;
  date_created: string | null;
  last_modified: string | null;
}

const rowToRepo = (row: RepoRow): Repo =>
  new Repo(
    row.project,
    row.name,
    row.url,
    // Guard against null/legacy rows so callers always see arrays.
    {
      canPush: row.users?.canPush ?? [],
      canAuthorise: row.users?.canAuthorise ?? [],
    },
    row._id,
    row.date_created ?? undefined,
    row.last_modified ?? undefined,
  );

const SELECT_COLUMNS = '_id, project, name, url, users, date_created, last_modified';

export const getRepos = async (q: Partial<RepoQuery> = {}): Promise<Repo[]> => {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (q.name) {
    values.push(q.name.toLowerCase());
    clauses.push(`name = $${values.length}`);
  }
  if (q.project !== undefined) {
    values.push(q.project);
    clauses.push(`project = $${values.length}`);
  }
  if (q.url) {
    values.push(q.url);
    clauses.push(`url = $${values.length}`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query<RepoRow>(`SELECT ${SELECT_COLUMNS} FROM repos ${where}`, values);
  return result.rows.map(rowToRepo);
};

export const getRepo = async (name: string): Promise<Repo | null> => {
  const result = await query<RepoRow>(`SELECT ${SELECT_COLUMNS} FROM repos WHERE name = $1`, [
    name.toLowerCase(),
  ]);
  return result.rowCount === 0 ? null : rowToRepo(result.rows[0]);
};

export const getRepoByUrl = async (url: string): Promise<Repo | null> => {
  const result = await query<RepoRow>(`SELECT ${SELECT_COLUMNS} FROM repos WHERE url = $1`, [url]);
  return result.rowCount === 0 ? null : rowToRepo(result.rows[0]);
};

export const getRepoById = async (_id: string): Promise<Repo | null> => {
  const result = await query<RepoRow>(`SELECT ${SELECT_COLUMNS} FROM repos WHERE _id = $1`, [_id]);
  return result.rowCount === 0 ? null : rowToRepo(result.rows[0]);
};

export const createRepo = async (repo: Repo): Promise<Repo> => {
  const users = repo.users ?? { canPush: [], canAuthorise: [] };
  const now = new Date().toISOString();
  if (!repo.dateCreated) repo.dateCreated = now;
  if (!repo.lastModified) repo.lastModified = now;
  const result = await query<{ _id: string }>(
    `INSERT INTO repos (project, name, url, users, date_created, last_modified)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)
     RETURNING _id`,
    [
      repo.project ?? '',
      repo.name,
      repo.url,
      JSON.stringify(users),
      repo.dateCreated,
      repo.lastModified,
    ],
  );
  repo._id = result.rows[0]._id;
  repo.users = users;
  return repo;
};

/**
 * Apply a partial update to a repo row. Only the supplied fields are written,
 * matching mongo's `$set` / `$unset` behaviour: a field explicitly set to
 * `undefined` is reset to the column default rather than left untouched.
 */
export const updateRepo = async (repo: Partial<Repo>): Promise<void> => {
  const { _id, ...fields } = repo;
  if (!_id) {
    throw new Error('updateRepo requires a repo _id');
  }

  const COLUMNS: Record<string, string> = {
    project: 'project',
    name: 'name',
    url: 'url',
    users: 'users',
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
    if (column === 'users') {
      values.push(JSON.stringify(value));
      sets.push(`${column} = $${values.length}::jsonb`);
      continue;
    }
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }

  if (sets.length === 0) {
    throw new Error('updateRepo requires at least one field to update');
  }

  values.push(_id);
  await query(`UPDATE repos SET ${sets.join(', ')} WHERE _id = $${values.length}`, values);
};

/**
 * Append a user to one of the JSONB permission arrays. The query is a
 * read-modify-write that deduplicates the value, then re-serialises the array
 * so the stored shape matches the existing mongo/fs backends exactly.
 */
const addUserToRole = async (
  _id: string,
  user: string,
  role: 'canPush' | 'canAuthorise',
): Promise<void> => {
  const lowered = user.toLowerCase();
  await query(
    `UPDATE repos
        SET users = jsonb_set(
          users,
          $2::text[],
          (
            SELECT to_jsonb(
              ARRAY(
                SELECT DISTINCT v
                  FROM jsonb_array_elements_text(coalesce(users->$3, '[]'::jsonb)) AS v
                UNION
                SELECT $4
              )
            )
          )
        ),
            last_modified = $5
      WHERE _id = $1`,
    [_id, `{${role}}`, role, lowered, new Date().toISOString()],
  );
};

const removeUserFromRole = async (
  _id: string,
  user: string,
  role: 'canPush' | 'canAuthorise',
): Promise<void> => {
  const lowered = user.toLowerCase();
  // The filter evaluates to `[]` if the last matching user is removed
  await query(
    `UPDATE repos
        SET users = jsonb_set(
          users,
          $2::text[],
          coalesce(
            (
              SELECT to_jsonb(array_agg(v))
                FROM jsonb_array_elements_text(coalesce(users->$3, '[]'::jsonb)) AS v
                WHERE v <> $4
            ),
            '[]'::jsonb
          )
        ),
            last_modified = $5
      WHERE _id = $1`,
    [_id, `{${role}}`, role, lowered, new Date().toISOString()],
  );
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
  await query(`DELETE FROM repos WHERE _id = $1`, [_id]);
};
