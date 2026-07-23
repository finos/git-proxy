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
  const {
    findUser,
    findUserByEmail,
    findUserByGitAccount,
    findUserByOIDC,
    findUserBySSHKey,
    createUser,
    deleteUser,
    getUsers,
    updateUser,
    addPublicKey,
    removePublicKey,
    getPublicKeys,
  } = await import('../../../src/db/postgres/users');

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

    it('lower-cases gitAccount on findUserByGitAccount', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      await findUserByGitAccount('Alice-Git');
      expect(mockQuery.mock.calls[0][1]).toEqual(['alice-git']);
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

  describe('row mapping', () => {
    it('maps a DB row to a User on findUser', async () => {
      mockQuery.mockResolvedValue({
        rowCount: 1,
        rows: [
          {
            _id: 'u1',
            username: 'alice',
            email: 'alice@example.com',
            password: 'hash',
            git_account: 'alice-git',
            admin: true,
            oidc_id: null,
            display_name: 'Alice A.',
            title: 'Dev',
          },
        ],
      });

      const user = await findUser('alice');

      expect(user).toMatchObject({
        _id: 'u1',
        username: 'alice',
        email: 'alice@example.com',
        password: 'hash',
        gitAccount: 'alice-git',
        admin: true,
        displayName: 'Alice A.',
        title: 'Dev',
      });
    });
  });

  describe('findUserByGitAccount', () => {
    it('queries by git_account and returns null when absent', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      const user = await findUserByGitAccount('alice-git');
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE git_account = $1');
      expect(params).toEqual(['alice-git']);
      expect(user).toBeNull();
    });
  });

  describe('findUserByOIDC', () => {
    it('queries by oidc_id and returns null when absent', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      const user = await findUserByOIDC('oidc-123');
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('WHERE oidc_id = $1');
      expect(params).toEqual(['oidc-123']);
      expect(user).toBeNull();
    });
  });

  describe('getUsers', () => {
    it('omits password from the SELECT projection', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      await getUsers({});
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toContain('NULL::text AS password');
    });

    it('builds lower-cased username and email filters', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
      await getUsers({ username: 'Alice', email: 'Alice@Example.com' });
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('username = $1');
      expect(sql).toContain('email = $2');
      expect(params).toEqual(['alice', 'alice@example.com']);
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

    it('upserts by username in a single atomic statement', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

      await updateUser({ username: 'new-user', email: 'new@example.com', admin: true } as never);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('INSERT INTO users');
      expect(sql).toContain('ON CONFLICT (username) DO UPDATE SET');
      // Only the supplied fields are merged onto an existing row.
      expect(sql).toContain(
        'username = EXCLUDED.username, email = EXCLUDED.email, admin = EXCLUDED.admin',
      );
      expect(sql).not.toContain('password = EXCLUDED.password');
      // username is the first INSERT param.
      expect((params as unknown[])[0]).toBe('new-user');
    });

    it('lower-cases username and email in the upsert', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

      await updateUser({ username: 'ExistingUser', email: 'Updated@Example.com' } as never);

      const [, params] = mockQuery.mock.calls[0];
      expect((params as unknown[]).slice(0, 2)).toEqual(['existinguser', 'updated@example.com']);
    });

    it('throws if neither _id nor username is supplied', async () => {
      await expect(updateUser({ admin: true } as never)).rejects.toThrow(
        'updateUser requires either _id or username',
      );
    });

    it('throws when no updatable field is supplied', async () => {
      await expect(updateUser({ _id: 'abc-123' } as never)).rejects.toThrow(
        'updateUser requires at least one field to update',
      );
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('SSH public keys', () => {
    const keyRecord = {
      key: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA-test',
      name: 'work laptop',
      addedAt: '2026-01-01T00:00:00.000Z',
      fingerprint: 'SHA256:abc123',
    };

    const userRow = (overrides: Record<string, unknown> = {}) => ({
      _id: 'u1',
      username: 'alice',
      email: 'alice@example.com',
      password: null,
      git_account: 'alice-git',
      admin: false,
      oidc_id: null,
      public_keys: [],
      display_name: null,
      title: null,
      ...overrides,
    });

    describe('findUserBySSHKey', () => {
      it('queries with JSONB containment on the key', async () => {
        mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
        const user = await findUserBySSHKey(keyRecord.key);
        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain('public_keys @> $1::jsonb');
        expect(params).toEqual([JSON.stringify([{ key: keyRecord.key }])]);
        expect(user).toBeNull();
      });

      it('maps public_keys onto the returned User', async () => {
        mockQuery.mockResolvedValue({
          rowCount: 1,
          rows: [userRow({ public_keys: [keyRecord] })],
        });
        const user = await findUserBySSHKey(keyRecord.key);
        expect(user?.publicKeys).toEqual([keyRecord]);
      });
    });

    describe('addPublicKey', () => {
      it('appends the key to the user public_keys array', async () => {
        mockQuery
          .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // findUserBySSHKey
          .mockResolvedValueOnce({ rowCount: 1, rows: [userRow()] }) // findUser
          .mockResolvedValueOnce({ rowCount: 1, rows: [] }); // UPDATE

        await addPublicKey('Alice', keyRecord);

        const [sql, params] = mockQuery.mock.calls[2];
        expect(sql).toContain('public_keys = public_keys || $2::jsonb');
        expect(params).toEqual(['alice', JSON.stringify([keyRecord])]);
      });

      it('throws DuplicateSSHKeyError when the key belongs to another user', async () => {
        mockQuery.mockResolvedValueOnce({
          rowCount: 1,
          rows: [userRow({ username: 'bob', public_keys: [keyRecord] })],
        });

        await expect(addPublicKey('alice', keyRecord)).rejects.toThrow(
          "SSH key already in use by user 'bob'",
        );
        expect(mockQuery).toHaveBeenCalledTimes(1);
      });

      it('allows re-checking a key that already maps to the same user', async () => {
        mockQuery.mockResolvedValueOnce({
          rowCount: 1,
          rows: [userRow({ public_keys: [keyRecord] })],
        });
        mockQuery.mockResolvedValueOnce({
          rowCount: 1,
          rows: [userRow({ public_keys: [keyRecord] })],
        });

        await expect(addPublicKey('ALICE', keyRecord)).rejects.toThrow('SSH key already exists');
      });

      it('throws when the user does not exist', async () => {
        mockQuery
          .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // findUserBySSHKey
          .mockResolvedValueOnce({ rowCount: 0, rows: [] }); // findUser

        await expect(addPublicKey('ghost', keyRecord)).rejects.toThrow('User not found');
      });

      it('throws when the fingerprint already exists for the user', async () => {
        const existing = { ...keyRecord, key: 'ssh-ed25519 DIFFERENT-KEY' };
        mockQuery
          .mockResolvedValueOnce({ rowCount: 0, rows: [] })
          .mockResolvedValueOnce({ rowCount: 1, rows: [userRow({ public_keys: [existing] })] });

        await expect(addPublicKey('alice', keyRecord)).rejects.toThrow('SSH key already exists');
      });
    });

    describe('removePublicKey', () => {
      it('filters the fingerprint out of public_keys and lower-cases username', async () => {
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [] });

        await removePublicKey('Alice', keyRecord.fingerprint);

        const [sql, params] = mockQuery.mock.calls[0];
        expect(sql).toContain(`(k->>'fingerprint') IS DISTINCT FROM $2`);
        expect(params).toEqual(['alice', keyRecord.fingerprint]);
      });
    });

    describe('getPublicKeys', () => {
      it('returns the user public keys', async () => {
        mockQuery.mockResolvedValue({
          rowCount: 1,
          rows: [userRow({ public_keys: [keyRecord] })],
        });
        await expect(getPublicKeys('alice')).resolves.toEqual([keyRecord]);
      });

      it('returns [] when the column is null', async () => {
        mockQuery.mockResolvedValue({ rowCount: 1, rows: [userRow({ public_keys: null })] });
        await expect(getPublicKeys('alice')).resolves.toEqual([]);
      });

      it('throws when the user does not exist', async () => {
        mockQuery.mockResolvedValue({ rowCount: 0, rows: [] });
        await expect(getPublicKeys('ghost')).rejects.toThrow('User not found');
      });
    });
  });
});
