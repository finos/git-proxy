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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as repoModule from '../../src/db/file/repo';
import { Repo } from '../../src/db/types';

vi.mock('../../src/db/mongo/helper', () => ({
  connect: vi.fn(),
}));

import { connect } from '../../src/db/mongo/helper';
import * as mongoRepo from '../../src/db/mongo/repo';

describe('Repo dateCreated / lastModified (#1486)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createRepo persists dateCreated and lastModified as ISO-8601', async () => {
    const inserted: Repo[] = [];
    vi.spyOn(repoModule.db, 'insert').mockImplementation((doc: unknown, cb: any) => {
      const stored = { ...(doc as Repo), _id: 'new-id' };
      inserted.push(stored);
      cb(null, stored);
    });

    const before = Date.now();
    const result = await repoModule.createRepo(
      new Repo('finos', 'sample', 'https://github.com/finos/sample.git'),
    );
    const after = Date.now();

    expect(result.dateCreated).toEqual(expect.any(String));
    expect(result.lastModified).toEqual(expect.any(String));
    expect(Date.parse(result.dateCreated!)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(result.dateCreated!)).toBeLessThanOrEqual(after);
    expect(result.dateCreated).toBe(result.lastModified);
    expect(inserted[0].dateCreated).toBe(result.dateCreated);
  });

  it('addUserCanPush bumps lastModified but leaves dateCreated unchanged', async () => {
    const existing: Repo = {
      project: 'finos',
      name: 'sample',
      url: 'https://github.com/finos/sample.git',
      users: { canPush: [], canAuthorise: [] },
      dateCreated: '2020-01-01T00:00:00.000Z',
      lastModified: '2020-01-01T00:00:00.000Z',
      _id: 'abc',
    };

    vi.spyOn(repoModule.db, 'findOne').mockImplementation((_: unknown, cb: any) =>
      cb(null, { ...existing }),
    );
    let updatedDoc: Repo | null = null;
    vi.spyOn(repoModule.db, 'update').mockImplementation(
      (_q: unknown, doc: any, _o: unknown, cb: any) => {
        updatedDoc = doc;
        cb(null, 1);
      },
    );

    await repoModule.addUserCanPush('abc', 'alice');

    expect(updatedDoc!.dateCreated).toBe('2020-01-01T00:00:00.000Z');
    expect(updatedDoc!.lastModified).not.toBe('2020-01-01T00:00:00.000Z');
    expect(Date.parse(updatedDoc!.lastModified!)).toBeGreaterThan(
      Date.parse('2020-01-01T00:00:00.000Z'),
    );
    expect(updatedDoc!.users.canPush).toContain('alice');
  });

  it('sort by dateCreated orders oldest → newest (asc)', () => {
    const repos: Pick<Repo, 'name' | 'dateCreated'>[] = [
      { name: 'zeta', dateCreated: '2024-06-01T00:00:00.000Z' },
      { name: 'alpha', dateCreated: '2023-01-01T00:00:00.000Z' },
      { name: 'mid', dateCreated: '2023-12-01T00:00:00.000Z' },
    ];

    const sorted = [...repos].sort(
      (a, b) => new Date(a.dateCreated || 0).getTime() - new Date(b.dateCreated || 0).getTime(),
    );

    expect(sorted.map((r) => r.name)).toEqual(['alpha', 'mid', 'zeta']);
  });

  it('sort by lastModified orders oldest → newest (asc)', () => {
    const repos: Pick<Repo, 'name' | 'lastModified'>[] = [
      { name: 'fresh', lastModified: '2025-01-01T00:00:00.000Z' },
      { name: 'stale', lastModified: '2022-01-01T00:00:00.000Z' },
      { name: 'mid', lastModified: '2024-01-01T00:00:00.000Z' },
    ];

    const sorted = [...repos].sort(
      (a, b) => new Date(a.lastModified || 0).getTime() - new Date(b.lastModified || 0).getTime(),
    );

    expect(sorted.map((r) => r.name)).toEqual(['stale', 'mid', 'fresh']);
  });

  it('NeDB backfillRepoDates fills missing fields without dropping other props', async () => {
    const docs: Repo[] = [
      {
        project: 'finos',
        name: 'legacy',
        url: 'https://github.com/finos/legacy.git',
        users: { canPush: ['bob'], canAuthorise: [] },
        _id: 'legacy-id',
      },
      {
        project: 'finos',
        name: 'partial',
        url: 'https://github.com/finos/partial.git',
        users: { canPush: [], canAuthorise: [] },
        dateCreated: '2021-06-01T00:00:00.000Z',
        _id: 'partial-id',
      },
    ];

    vi.spyOn(repoModule.db, 'find').mockImplementation((_q: unknown, cb: any) => cb(null, docs));

    const patches: Array<{ id: string; set: Record<string, string> }> = [];
    vi.spyOn(repoModule.db, 'update').mockImplementation(
      (q: any, update: any, _o: unknown, cb: any) => {
        patches.push({ id: q._id, set: update.$set });
        cb(null, 1);
      },
    );

    const fallback = '1970-01-01T00:00:00.000Z';
    const updated = await repoModule.backfillRepoDates(fallback);

    expect(updated).toBe(2);
    expect(patches).toEqual(
      expect.arrayContaining([
        {
          id: 'legacy-id',
          set: { dateCreated: fallback, lastModified: fallback },
        },
        {
          id: 'partial-id',
          set: {
            dateCreated: '2021-06-01T00:00:00.000Z',
            lastModified: '2021-06-01T00:00:00.000Z',
          },
        },
      ]),
    );
  });

  it('NeDB backfillRepoDates is a no-op when all repos already have dates', async () => {
    vi.spyOn(repoModule.db, 'find').mockImplementation((_q: unknown, cb: any) => cb(null, []));
    const updateSpy = vi.spyOn(repoModule.db, 'update');

    const updated = await repoModule.backfillRepoDates();

    expect(updated).toBe(0);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('Mongo backfillRepoDates uses updateMany with $ifNull pipeline', async () => {
    const updateMany = vi.fn().mockResolvedValue({ modifiedCount: 3 });
    vi.mocked(connect).mockResolvedValue({ updateMany } as any);

    const fallback = '1970-01-01T00:00:00.000Z';
    const updated = await mongoRepo.backfillRepoDates(fallback);

    expect(updated).toBe(3);
    expect(updateMany).toHaveBeenCalledWith(
      {
        $or: [{ dateCreated: { $exists: false } }, { lastModified: { $exists: false } }],
      },
      [
        {
          $set: {
            dateCreated: { $ifNull: ['$dateCreated', fallback] },
            lastModified: {
              $ifNull: ['$lastModified', { $ifNull: ['$dateCreated', fallback] }],
            },
          },
        },
      ],
    );
  });
});
