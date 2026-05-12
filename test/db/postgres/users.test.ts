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

describe('PostgreSQL - Users', async () => {
  const { findUser, findUserByEmail, createUser, deleteUser, getUsers, updateUser } =
    await import('../../../src/db/postgres/users');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('case insensitivity', () => {
    it('lower-cases username on findUser', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      await findUser('Mixed-Case');
      expect(mockQuery.mock.calls[0][1]).toEqual(['mixed-case']);
    });

    it('lower-cases email on findUserByEmail', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      await findUserByEmail('USER@Example.COM');
      expect(mockQuery.mock.calls[0][1]).toEqual(['user@example.com']);
    });

    it('lower-cases username/email on createUser', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await createUser({
        username: 'Alice',
        password: 'pw',
        gitAccount: 'alice-git',
        email: 'Alice@Example.com',
        admin: false,
      } as never);

      const params = mockQuery.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe('alice');
      expect(params[1]).toBe('alice@example.com');
    });

    it('lower-cases username on deleteUser', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });
      await deleteUser('Alice');
      expect(mockQuery.mock.calls[0][1]).toEqual(['alice']);
    });
  });

  describe('getUsers', () => {
    it('omits password from the SELECT projection', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      await getUsers({});
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('NULL::text AS password');
    });
  });

  describe('updateUser', () => {
    it('updates by _id when provided', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

      await updateUser({ _id: 'abc-123', displayName: 'Alice A.' } as never);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('UPDATE users SET');
      expect(sql).toContain('WHERE _id = $');
      expect(params).toEqual(['Alice A.', 'abc-123']);
    });

    it('falls back to username and inserts when no row matches', async () => {
      mockQuery
        .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // UPDATE matches nothing
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT

      await updateUser({ username: 'new-user', email: 'new@example.com', admin: true } as never);

      expect(mockQuery).toHaveBeenCalledTimes(2);
      const [updateSql] = mockQuery.mock.calls[0];
      const [insertSql, insertParams] = mockQuery.mock.calls[1];
      expect(updateSql).toContain('WHERE username = $');
      expect(insertSql).toContain('INSERT INTO users');
      // username is the first INSERT param.
      expect(insertParams[0]).toBe('new-user');
    });

    it('uses a separate username parameter for the username-keyed UPDATE filter', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

      await updateUser({ username: 'ExistingUser', email: 'updated@example.com' } as never);

      const [updateSql, updateParams] = mockQuery.mock.calls[0];
      expect(updateSql).toContain('UPDATE users SET username = $1, email = $2 WHERE username = $3');
      expect(updateParams).toEqual(['existinguser', 'updated@example.com', 'existinguser']);
    });

    it('throws if neither _id nor username is supplied', async () => {
      await expect(updateUser({ admin: true } as never)).rejects.toThrow(
        'updateUser requires either _id or username',
      );
    });
  });
});
