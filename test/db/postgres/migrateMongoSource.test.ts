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

const mockConnect = vi.fn();
const mockClose = vi.fn();
const mockCtor = vi.fn();

const docsByCollection: Record<string, unknown[]> = {};

vi.mock('mongodb', () => ({
  MongoClient: class {
    constructor(connectionString: string, options: unknown) {
      mockCtor(connectionString, options);
    }
    connect = mockConnect;
    close = mockClose;
    db() {
      return {
        collection: (name: string) => ({
          find: () => ({ toArray: () => Promise.resolve(docsByCollection[name] ?? []) }),
        }),
      };
    }
  },
}));

describe('PostgreSQL - migrate mongo source', async () => {
  const { createMongoSource } = await import('../../../src/db/postgres/migrateMongoSource');

  beforeEach(() => {
    vi.clearAllMocks();
    docsByCollection.users = [
      { _id: 'objid-1', username: 'alice', email: 'alice@x.com', gitAccount: 'a', admin: true },
    ];
    docsByCollection.repos = [{ _id: 'objid-2', project: 'p', name: 'n', url: 'https://x/n.git' }];
    docsByCollection.pushes = [{ _id: 'objid-3', id: 'push-1', type: 'push' }];
  });

  it('connects with the supplied connection string and options', async () => {
    await createMongoSource('mongodb://localhost/src', { tls: true });
    expect(mockCtor).toHaveBeenCalledWith('mongodb://localhost/src', { tls: true });
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('reads users, repos and pushes from their collections', async () => {
    const source = await createMongoSource('mongodb://localhost/src');

    const users = await source.getUsers();
    const repos = await source.getRepos();
    const pushes = await source.getPushes();

    expect(users.map((u) => u.username)).toEqual(['alice']);
    expect(repos.map((r) => r.url)).toEqual(['https://x/n.git']);
    expect(pushes.map((p) => p.id)).toEqual(['push-1']);
  });

  it('closes the underlying client', async () => {
    const source = await createMongoSource('mongodb://localhost/src');
    await source.close();
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
