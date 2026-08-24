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

import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockQuery = vi.fn();

vi.mock('../../../src/db/postgres/helper', () => ({
  query: mockQuery,
}));

describe('PostgreSQL - Repo', async () => {
  const {
    getRepos,
    getRepo,
    getRepoById,
    getRepoByUrl,
    updateRepo,
    createRepo,
    addUserCanPush,
    addUserCanAuthorise,
    removeUserCanPush,
    removeUserCanAuthorise,
    deleteRepo,
  } = await import('../../../src/db/postgres/repo');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRepos', () => {
    it('builds WHERE clauses and maps the join-aggregated rows', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            _id: 'r1',
            project: 'finos',
            name: 'git-proxy',
            url: 'https://example.com/finos/git-proxy',
            can_push: ['bob'],
            can_authorise: [],
          },
        ],
      });

      const repos = await getRepos({
        name: 'Git-Proxy',
        project: 'finos',
        url: 'https://example.com/finos/git-proxy',
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('LEFT JOIN repo_users');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('r.name = $1');
      expect(sql).toContain('r.project = $2');
      expect(sql).toContain('r.url = $3');
      expect(params).toEqual(['git-proxy', 'finos', 'https://example.com/finos/git-proxy']);
      expect(repos[0].users.canPush).toEqual(['bob']);
    });

    it('adds no filter clause but still groups when no query is supplied', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      await getRepos();
      const [sql, params] = mockQuery.mock.calls[0];
      expect(params).toEqual([]);
      expect(sql).not.toContain('r.name =');
      expect(sql).not.toContain('r.url =');
      expect(sql).toContain('GROUP BY');
    });
  });

  describe('getRepoByUrl', () => {
    it('returns null when no row matches', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      expect(await getRepoByUrl('https://missing')).toBeNull();
    });

    it('maps the aggregated row when found', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            _id: 'r1',
            project: 'p',
            name: 'n',
            url: 'https://example.com/p/n',
            can_push: [],
            can_authorise: ['amy'],
          },
        ],
      });
      const repo = await getRepoByUrl('https://example.com/p/n');
      expect(repo?.users.canAuthorise).toEqual(['amy']);
    });
  });

  describe('read normalization', () => {
    it('returns empty arrays when the aggregated columns are null', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            _id: 'r-1',
            project: 'p',
            name: 'n',
            url: 'https://example.com/p/n',
            can_push: null,
            can_authorise: null,
          },
        ],
      });

      const repo = await getRepoById('r-1');
      expect(repo?.users.canPush).toEqual([]);
      expect(repo?.users.canAuthorise).toEqual([]);
    });

    it('lower-cases the name on getRepo', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      await getRepo('MixedCase');
      expect(mockQuery.mock.calls[0][1]).toEqual(['mixedcase']);
    });
  });

  describe('createRepo', () => {
    it('inserts the repo row and stamps _id from RETURNING', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ _id: 'generated-uuid' }] });

      const created = await createRepo({
        project: 'finos',
        name: 'git-proxy',
        url: 'https://github.com/finos/git-proxy.git',
        users: { canPush: [], canAuthorise: [] },
      } as never);

      expect(created._id).toBe('generated-uuid');
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO repos');
      expect(params).toEqual(['finos', 'git-proxy', 'https://github.com/finos/git-proxy.git']);
      // No second call: empty permissions mean no repo_users inserts.
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('persists supplied permissions into repo_users', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ _id: 'r9' }] });

      await createRepo({
        project: 'p',
        name: 'n',
        url: 'https://x/n.git',
        users: { canPush: ['bob'], canAuthorise: ['amy'] },
      } as never);

      const inserts = mockQuery.mock.calls.slice(1);
      expect(inserts).toHaveLength(2);
      expect(inserts.every(([sql]) => /INSERT INTO repo_users/.test(String(sql)))).toBe(true);
      expect(inserts[0][1]).toEqual(['r9', 'bob', 'canPush']);
      expect(inserts[1][1]).toEqual(['r9', 'amy', 'canAuthorise']);
    });
  });

  describe('add / remove user', () => {
    it('addUserCanPush inserts a lower-cased canPush row, ignoring duplicates', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await addUserCanPush('r-1', 'Bob');
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO repo_users');
      expect(sql).toContain('ON CONFLICT DO NOTHING');
      expect(params).toEqual(['r-1', 'bob', 'canPush']);
    });

    it('addUserCanAuthorise targets the canAuthorise role', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await addUserCanAuthorise('r-1', 'Amy');
      expect(mockQuery.mock.calls[0][1]).toEqual(['r-1', 'amy', 'canAuthorise']);
    });

    it('removeUserCanPush deletes the lower-cased canPush row', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await removeUserCanPush('r-1', 'Bob');
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('DELETE FROM repo_users');
      expect(params).toEqual(['r-1', 'bob', 'canPush']);
    });

    it('removeUserCanAuthorise deletes the canAuthorise row', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await removeUserCanAuthorise('r-1', 'Amy');
      expect(mockQuery.mock.calls[0][1]).toEqual(['r-1', 'amy', 'canAuthorise']);
    });
  });

  describe('deleteRepo', () => {
    it('issues a DELETE by _id (repo_users cascades)', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await deleteRepo('r1');
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('DELETE FROM repos WHERE _id = $1');
      expect(params).toEqual(['r1']);
    });
  });

  describe('updateRepo', () => {
    it('writes only the supplied fields', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

      await updateRepo({ _id: 'r1', name: 'renamed' });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('UPDATE repos SET name = $1');
      expect(sql).toContain('WHERE _id = $2');
      expect(params).toEqual(['renamed', 'r1']);
    });

    it('replaces permissions in the repo_users join table', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

      await updateRepo({ _id: 'r1', users: { canPush: ['alice'], canAuthorise: ['bob'] } });

      const statements = mockQuery.mock.calls.map(([sql]) => sql);
      // old rows are cleared first, then each role is re-inserted
      expect(statements[0]).toContain('DELETE FROM repo_users WHERE repo_id = $1');
      expect(statements.slice(1).join('\n')).toContain('INSERT INTO repo_users');
      const roles = mockQuery.mock.calls.slice(1).map(([, params]) => params?.[2]);
      expect(roles).toEqual(['canPush', 'canAuthorise']);
    });

    it('updates columns and permissions together', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

      await updateRepo({ _id: 'r1', name: 'renamed', users: { canPush: [], canAuthorise: [] } });

      const statements = mockQuery.mock.calls.map(([sql]) => sql);
      expect(statements[0]).toContain('UPDATE repos SET name = $1');
      expect(statements[1]).toContain('DELETE FROM repo_users');
    });

    it('resets a field back to its column default when set to undefined', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

      await updateRepo({ _id: 'r1', project: undefined, name: 'keep' });

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('project = DEFAULT');
      expect(sql).toContain('name = $1');
    });

    it('ignores unknown fields', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

      await updateRepo({ _id: 'r1', name: 'x', bogus: 'y' } as never);

      const [sql] = mockQuery.mock.calls[0];
      expect(sql).not.toContain('bogus');
    });

    it('requires an _id', async () => {
      await expect(updateRepo({ name: 'x' })).rejects.toThrow('updateRepo requires a repo _id');
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('rejects an update with nothing to change', async () => {
      await expect(updateRepo({ _id: 'r1' })).rejects.toThrow(
        'updateRepo requires at least one field to update',
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });
});
