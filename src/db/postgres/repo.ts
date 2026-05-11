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

// TODO(#1497-followup): consider normalizing repo permissions into a
// repo_users(repo_id, user, role) join table. JSONB is used for v1 to
// match the mongo/fs shape and minimize migration churn — the issue
// flags this as an open question for a follow-up PR.

import { Repo, RepoQuery } from '../types';
import { query } from './helper';

interface RepoRow {
  _id: string;
  project: string;
  name: string;
  url: string;
  users: { canPush: string[]; canAuthorise: string[] } | null;
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
  );

const SELECT_COLUMNS = '_id, project, name, url, users';

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
  const result = await query<{ _id: string }>(
    `INSERT INTO repos (project, name, url, users)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING _id`,
    [repo.project ?? '', repo.name, repo.url, JSON.stringify(users)],
  );
  repo._id = result.rows[0]._id;
  repo.users = users;
  return repo;
};

/**
 * Append a user to one of the JSONB permission arrays. The query is a
 * read-modify-write that deduplicates the value, then re-serialises the array
 * so the stored shape matches the existing mongo/fs backends exactly.
 *
 * Crucially: when the last user is later removed, the array stays `[]` rather
 * than collapsing to `null` — issue #1497 explicitly requires this.
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
        )
      WHERE _id = $1`,
    [_id, `{${role}}`, role, lowered],
  );
};

const removeUserFromRole = async (
  _id: string,
  user: string,
  role: 'canPush' | 'canAuthorise',
): Promise<void> => {
  const lowered = user.toLowerCase();
  // The filter expression evaluates to `[]` if the last matching user is
  // removed — preserving the empty-array invariant from issue #1497.
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
        )
      WHERE _id = $1`,
    [_id, `{${role}}`, role, lowered],
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
