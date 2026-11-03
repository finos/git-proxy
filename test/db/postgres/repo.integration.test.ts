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

import { describe, it, expect } from 'vitest';
import {
  createRepo,
  getRepo,
  getRepoByUrl,
  getRepoById,
  getRepos,
  addUserCanPush,
  addUserCanAuthorise,
  removeUserCanPush,
  removeUserCanAuthorise,
  deleteRepo,
} from '../../../src/db/postgres/repo';
import { query } from '../../../src/db/postgres/helper';
import { Repo } from '../../../src/db/types';

const shouldRunPostgresTests = process.env.RUN_POSTGRES_TESTS === 'true';

const createTestRepo = (overrides: Partial<Repo> = {}): Repo => {
  const id = Date.now() + Math.floor(Math.random() * 10_000);
  return new Repo(
    overrides.project ?? 'test-project',
    overrides.name ?? `repo-${id}`,
    overrides.url ?? `https://github.com/test-project/repo-${id}.git`,
    overrides.users ?? { canPush: [], canAuthorise: [] },
  );
};

describe.runIf(shouldRunPostgresTests)('PostgreSQL Repo Integration Tests', () => {
  describe('createRepo', () => {
    it('persists the row and stamps a generated _id', async () => {
      const repo = createTestRepo({ name: 'create-test', url: 'https://example.com/x.git' });
      const created = await createRepo(repo);

      expect(created._id).toBeDefined();
      expect(created._id).toMatch(/^[0-9a-f-]{36}$/i);

      const fromDb = await getRepoByUrl('https://example.com/x.git');
      expect(fromDb?.name).toBe('create-test');
    });
  });

  describe('getRepo / getRepoByUrl / getRepoById', () => {
    it('finds by name (lower-cased lookup)', async () => {
      await createRepo(createTestRepo({ name: 'findme', url: 'https://example.com/findme.git' }));
      const found = await getRepo('FINDME');
      expect(found?.name).toBe('findme');
    });

    it('finds by url exactly', async () => {
      const url = 'https://example.com/url-test.git';
      await createRepo(createTestRepo({ name: 'url-test', url }));
      const found = await getRepoByUrl(url);
      expect(found?.url).toBe(url);
    });

    it('finds by _id', async () => {
      const created = await createRepo(
        createTestRepo({ name: 'id-test', url: 'https://example.com/id-test.git' }),
      );
      const fromDb = await getRepoById(created._id as string);
      expect(fromDb?.url).toBe('https://example.com/id-test.git');
    });

    it('returns null when nothing matches', async () => {
      expect(await getRepo('does-not-exist')).toBeNull();
      expect(await getRepoByUrl('https://nope.example/x.git')).toBeNull();
    });
  });

  describe('getRepos', () => {
    it('returns the seeded repos', async () => {
      await createRepo(createTestRepo({ name: 'list-1', url: 'https://example.com/l1.git' }));
      await createRepo(createTestRepo({ name: 'list-2', url: 'https://example.com/l2.git' }));

      const all = await getRepos();
      const names = all.map((r) => r.name);
      expect(names).toEqual(expect.arrayContaining(['list-1', 'list-2']));
    });
  });

  describe('permission membership', () => {
    it('starts with empty arrays', async () => {
      const created = await createRepo(
        createTestRepo({ name: 'perm-start', url: 'https://example.com/ps.git' }),
      );
      const fromDb = await getRepoById(created._id as string);
      expect(fromDb?.users.canPush).toEqual([]);
      expect(fromDb?.users.canAuthorise).toEqual([]);
    });

    it('adds a user without duplication', async () => {
      const created = await createRepo(
        createTestRepo({ name: 'perm-add', url: 'https://example.com/pa.git' }),
      );
      const id = created._id as string;

      await addUserCanPush(id, 'Alice');
      await addUserCanPush(id, 'alice'); // duplicate (after lower-casing)

      const fromDb = await getRepoById(id);
      expect(fromDb?.users.canPush).toEqual(['alice']);
    });

    it('removes the last user, leaving an empty array (NOT null)', async () => {
      const created = await createRepo(
        createTestRepo({ name: 'perm-remove', url: 'https://example.com/pr.git' }),
      );
      const id = created._id as string;

      await addUserCanPush(id, 'bob');
      await removeUserCanPush(id, 'bob');

      const fromDb = await getRepoById(id);
      // Same behavior as Mongo and NeDB
      expect(fromDb?.users.canPush).toEqual([]);
      expect(fromDb?.users.canPush).not.toBeNull();
    });

    it('applies the same invariant to canAuthorise', async () => {
      const created = await createRepo(
        createTestRepo({ name: 'auth-remove', url: 'https://example.com/ar.git' }),
      );
      const id = created._id as string;

      await addUserCanAuthorise(id, 'reviewer');
      await removeUserCanAuthorise(id, 'reviewer');

      const fromDb = await getRepoById(id);
      expect(fromDb?.users.canAuthorise).toEqual([]);
      expect(fromDb?.users.canAuthorise).not.toBeNull();
    });

    it('keeps other users intact when removing one', async () => {
      const created = await createRepo(
        createTestRepo({ name: 'multi-perm', url: 'https://example.com/mp.git' }),
      );
      const id = created._id as string;

      await addUserCanPush(id, 'alice');
      await addUserCanPush(id, 'bob');
      await removeUserCanPush(id, 'alice');

      const fromDb = await getRepoById(id);
      expect(fromDb?.users.canPush).toEqual(['bob']);
    });
  });

  describe('deleteRepo', () => {
    it('deletes by _id', async () => {
      const created = await createRepo(
        createTestRepo({ name: 'del', url: 'https://example.com/del.git' }),
      );
      await deleteRepo(created._id as string);
      expect(await getRepoById(created._id as string)).toBeNull();
    });
  });

  describe('repo_users normalization (issue #1559)', () => {
    it('stores permissions as rows in repo_users, with no JSONB column on repos', async () => {
      const created = await createRepo(
        createTestRepo({ name: 'norm', url: 'https://example.com/norm.git' }),
      );
      const id = created._id as string;
      await addUserCanPush(id, 'alice');
      await addUserCanAuthorise(id, 'reviewer');

      const rows = await query<{ username: string; role: string }>(
        `SELECT username, role FROM repo_users WHERE repo_id = $1 ORDER BY role, username`,
        [id],
      );
      expect(rows.rows).toEqual([
        { username: 'reviewer', role: 'canAuthorise' },
        { username: 'alice', role: 'canPush' },
      ]);

      // The legacy JSONB column was dropped by migration 4 (drop_repos_users_jsonb).
      const cols = await query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'repos'`,
      );
      expect(cols.rows.map((r) => r.column_name)).not.toContain('users');
    });

    it('cascades repo_users rows when the repo is deleted', async () => {
      const created = await createRepo(
        createTestRepo({ name: 'cascade', url: 'https://example.com/cascade.git' }),
      );
      const id = created._id as string;
      await addUserCanPush(id, 'alice');

      await deleteRepo(id);

      const rows = await query(`SELECT 1 FROM repo_users WHERE repo_id = $1`, [id]);
      expect(rows.rowCount).toBe(0);
    });
  });
});
