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
    it('builds WHERE clauses for name, project and url and maps rows', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            _id: 'r1',
            project: 'finos',
            name: 'git-proxy',
            url: 'https://example.com/finos/git-proxy',
            users: { canPush: ['bob'], canAuthorise: [] },
          },
        ],
      });

      const repos = await getRepos({
        name: 'Git-Proxy',
        project: 'finos',
        url: 'https://example.com/finos/git-proxy',
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE');
      expect(sql).toContain('name = $1');
      expect(sql).toContain('project = $2');
      expect(sql).toContain('url = $3');
      expect(params).toEqual(['git-proxy', 'finos', 'https://example.com/finos/git-proxy']);
      expect(repos[0].users.canPush).toEqual(['bob']);
    });

    it('omits the WHERE clause when no query is supplied', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      await getRepos();
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).not.toContain('WHERE');
    });
  });

  describe('getRepoByUrl', () => {
    it('returns null when no row matches', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      expect(await getRepoByUrl('https://missing')).toBeNull();
    });

    it('maps the row when found', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            _id: 'r1',
            project: 'p',
            name: 'n',
            url: 'https://example.com/p/n',
            users: { canPush: [], canAuthorise: ['amy'] },
          },
        ],
      });
      const repo = await getRepoByUrl('https://example.com/p/n');
      expect(repo?.users.canAuthorise).toEqual(['amy']);
    });
  });

  describe('deleteRepo', () => {
    it('issues a DELETE by _id', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await deleteRepo('r1');
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('DELETE FROM repos WHERE _id = $1');
      expect(params).toEqual(['r1']);
    });
  });

  describe('read normalization', () => {
    it('returns empty arrays when stored users is null', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            _id: 'r-1',
            project: 'p',
            name: 'n',
            url: 'https://example.com/p/n',
            users: null,
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
    it('serialises default users JSONB and stamps _id from RETURNING', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [{ _id: 'generated-uuid' }] });

      const created = await createRepo({
        project: 'finos',
        name: 'git-proxy',
        url: 'https://github.com/finos/git-proxy.git',
        users: { canPush: [], canAuthorise: [] },
      } as never);

      expect(created._id).toBe('generated-uuid');
      const params = mockQuery.mock.calls[0][1] as unknown[];
      // Last param is the JSONB string for users.
      expect(JSON.parse(params[3] as string)).toEqual({ canPush: [], canAuthorise: [] });
    });
  });

  describe('add/remove user — empty array invariant', () => {
    it('lower-cases user on add', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await addUserCanPush('r-1', 'Bob');
      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(params).toContain('bob');
    });

    it('addUserCanAuthorise lower-cases user and targets the canAuthorise role', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await addUserCanAuthorise('r-1', 'Amy');
      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(params).toContain('amy');
      expect(params).toContain('{canAuthorise}');
    });

    it('removeUserCanPush coalesces filtered array to [] when last user leaves', () => {
      // The whole point of the issue: the SQL fragment must coalesce a NULL
      // aggregate result back to '[]'::jsonb so the array does not collapse
      // to null when the last user is removed.
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      return removeUserCanPush('r-1', 'bob').then(() => {
        const [sql] = mockQuery.mock.calls[0];
        expect(sql).toContain('coalesce(');
        expect(sql).toContain("'[]'::jsonb");
      });
    });

    it('removeUserCanAuthorise applies the same empty-array coalesce', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await removeUserCanAuthorise('r-1', 'bob');
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('coalesce(');
      expect(sql).toContain("'[]'::jsonb");
    });
  });
});
