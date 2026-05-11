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
    getRepo,
    getRepoById,
    createRepo,
    addUserCanPush,
    removeUserCanPush,
    removeUserCanAuthorise,
  } = await import('../../../src/db/postgres/repo');

  beforeEach(() => {
    vi.clearAllMocks();
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

  describe('add/remove user — empty array invariant (issue #1497)', () => {
    it('lower-cases user on add', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await addUserCanPush('r-1', 'Bob');
      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(params).toContain('bob');
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
