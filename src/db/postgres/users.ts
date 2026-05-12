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

import { User, UserQuery } from '../types';
import { query } from './helper';

interface UserRow {
  _id: string;
  username: string;
  email: string;
  password: string | null;
  git_account: string;
  admin: boolean;
  oidc_id: string | null;
  display_name: string | null;
  title: string | null;
}

const rowToUser = (row: UserRow): User => {
  const user = new User(
    row.username,
    row.password ?? '',
    row.git_account,
    row.email,
    row.admin,
    row.oidc_id,
    row._id,
  );
  user.password = row.password;
  user.displayName = row.display_name;
  user.title = row.title;
  return user;
};

const SELECT_COLUMNS =
  '_id, username, email, password, git_account, admin, oidc_id, display_name, title';

export const findUser = async (username: string): Promise<User | null> => {
  const result = await query<UserRow>(`SELECT ${SELECT_COLUMNS} FROM users WHERE username = $1`, [
    username.toLowerCase(),
  ]);
  return result.rowCount === 0 ? null : rowToUser(result.rows[0]);
};

export const findUserByEmail = async (email: string): Promise<User | null> => {
  const result = await query<UserRow>(`SELECT ${SELECT_COLUMNS} FROM users WHERE email = $1`, [
    email.toLowerCase(),
  ]);
  return result.rowCount === 0 ? null : rowToUser(result.rows[0]);
};

export const findUserByOIDC = async (oidcId: string): Promise<User | null> => {
  const result = await query<UserRow>(`SELECT ${SELECT_COLUMNS} FROM users WHERE oidc_id = $1`, [
    oidcId,
  ]);
  return result.rowCount === 0 ? null : rowToUser(result.rows[0]);
};

export const getUsers = async (q: Partial<UserQuery> = {}): Promise<User[]> => {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (q.username) {
    values.push(q.username.toLowerCase());
    clauses.push(`username = $${values.length}`);
  }
  if (q.email) {
    values.push(q.email.toLowerCase());
    clauses.push(`email = $${values.length}`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  // Match mongo's `.project({ password: 0 })` — omit password from list results.
  const result = await query<UserRow>(
    `SELECT _id, username, email, NULL::text AS password, git_account, admin, oidc_id, display_name, title
       FROM users ${where}`,
    values,
  );
  return result.rows.map(rowToUser);
};

export const createUser = async (user: User): Promise<void> => {
  await query(
    `INSERT INTO users (username, email, password, git_account, admin, oidc_id, display_name, title)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      user.username.toLowerCase(),
      user.email.toLowerCase(),
      user.password ?? null,
      user.gitAccount,
      user.admin,
      user.oidcId ?? null,
      user.displayName ?? null,
      user.title ?? null,
    ],
  );
};

export const deleteUser = async (username: string): Promise<void> => {
  await query(`DELETE FROM users WHERE username = $1`, [username.toLowerCase()]);
};

/**
 * Update an existing user, or insert a new one if no matching row exists.
 *
 * Mirrors the mongo adapter's upsert semantics: partial updates are merged
 * onto an existing row (only supplied fields are written), and a missing row
 * is created. Identity is by `_id` when provided, otherwise by `username`.
 */
export const updateUser = async (user: Partial<User>): Promise<void> => {
  const username = user.username?.toLowerCase();
  const email = user.email?.toLowerCase();

  // Build the SET fragment dynamically so callers can patch arbitrary fields.
  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };

  if (username !== undefined) set('username', username);
  if (email !== undefined) set('email', email);
  if (user.password !== undefined) set('password', user.password);
  if (user.gitAccount !== undefined) set('git_account', user.gitAccount);
  if (user.admin !== undefined) set('admin', user.admin);
  if (user.oidcId !== undefined) set('oidc_id', user.oidcId);
  if (user.displayName !== undefined) set('display_name', user.displayName);
  if (user.title !== undefined) set('title', user.title);

  if (user._id) {
    values.push(user._id);
    await query(`UPDATE users SET ${sets.join(', ')} WHERE _id = $${values.length}`, values);
    return;
  }

  if (!username) {
    throw new Error('updateUser requires either _id or username');
  }

  // Upsert by username when no _id is supplied, matching mongo's behaviour.
  values.push(username);
  const result = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE username = $${values.length}`,
    values,
  );
  if (result.rowCount && result.rowCount > 0) return;

  await query(
    `INSERT INTO users (username, email, password, git_account, admin, oidc_id, display_name, title)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (username) DO NOTHING`,
    [
      username,
      email ?? '',
      user.password ?? null,
      user.gitAccount ?? '',
      user.admin ?? false,
      user.oidcId ?? null,
      user.displayName ?? null,
      user.title ?? null,
    ],
  );
};
