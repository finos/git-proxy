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

import { describe, it, expect, vi } from 'vitest';
import { exampleMigration } from '../../../src/db/migrations/example';
import type { Sink } from '../../../src/db/types';

type RepoRecord = Record<string, unknown> & { _id: string };

const makeSink = (repos: RepoRecord[], deriveCreatedAt: (id: string) => string | undefined) => {
  const store = new Map(repos.map((r) => [r._id, { ...r }]));
  const updateRepo = vi.fn(async (repo: Record<string, unknown>) => {
    const { _id, ...fields } = repo;
    Object.assign(store.get(_id as string) as RepoRecord, fields);
  });
  const sink = {
    getRepos: async () => [...store.values()],
    updateRepo,
    deriveCreatedAt,
  } as unknown as Sink;
  return { sink, updateRepo, get: (id: string) => store.get(id) };
};

describe('example migration', () => {
  it('sets dateCreated from the backend-derived value and mirrors it to lastModified', async () => {
    const { sink, get } = makeSink([{ _id: 'r1' }], () => '2020-01-01T00:00:00.000Z');

    await exampleMigration.up(sink);

    expect(get('r1')?.dateCreated).toBe('2020-01-01T00:00:00.000Z');
    expect(get('r1')?.lastModified).toBe('2020-01-01T00:00:00.000Z');
  });

  it('falls back to a valid timestamp when the backend cannot derive one', async () => {
    const { sink, get } = makeSink([{ _id: 'r1' }], () => undefined);

    await exampleMigration.up(sink);

    const created = get('r1')?.dateCreated;
    expect(created).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(get('r1')?.lastModified).toBe(created);
  });

  it('leaves repos that already have a dateCreated untouched', async () => {
    const { sink, updateRepo, get } = makeSink(
      [{ _id: 'r1', dateCreated: '2019-05-05T00:00:00.000Z' }],
      () => '2020-01-01T00:00:00.000Z',
    );

    await exampleMigration.up(sink);

    expect(updateRepo).not.toHaveBeenCalled();
    expect(get('r1')?.dateCreated).toBe('2019-05-05T00:00:00.000Z');
  });

  it('down removes the timestamps it added', async () => {
    const { sink, get } = makeSink(
      [
        {
          _id: 'r1',
          dateCreated: '2020-01-01T00:00:00.000Z',
          lastModified: '2020-01-01T00:00:00.000Z',
        },
      ],
      () => undefined,
    );

    await exampleMigration.down!(sink);

    expect(get('r1')?.dateCreated).toBeUndefined();
    expect(get('r1')?.lastModified).toBeUndefined();
  });
});
