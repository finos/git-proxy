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
import { populateRepoDates } from '../../../src/db/migrations/populateRepoDates';
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

describe('populateRepoDates migration', () => {
  it('is registered under a sortable, timestamped id', () => {
    expect(populateRepoDates.id).toBe('20260729-populate-repo-dates');
  });

  it('backfills dateCreated from the backend-derived value', async () => {
    const { sink, get } = makeSink([{ _id: 'r1' }], () => '2020-01-01T00:00:00.000Z');

    await populateRepoDates.up(sink);

    expect(get('r1')?.dateCreated).toBe('2020-01-01T00:00:00.000Z');
    expect(get('r1')?.lastModified).toBe('2020-01-01T00:00:00.000Z');
  });

  it('falls back to the run time when the backend cannot derive one', async () => {
    // the file backend always returns undefined - NeDB ids carry no timestamp
    const before = Date.now();
    const { sink, get } = makeSink([{ _id: 'r1' }], () => undefined);

    await populateRepoDates.up(sink);

    const created = get('r1')?.dateCreated as string;
    expect(Date.parse(created)).toBeGreaterThanOrEqual(before);
    expect(get('r1')?.lastModified).toBe(created);
  });

  it('preserves an existing lastModified instead of overwriting it', async () => {
    // role mutations bump lastModified on repos that never had a dateCreated
    const { sink, get } = makeSink(
      [{ _id: 'r1', lastModified: '2024-06-01T00:00:00.000Z' }],
      () => '2020-01-01T00:00:00.000Z',
    );

    await populateRepoDates.up(sink);

    expect(get('r1')?.dateCreated).toBe('2020-01-01T00:00:00.000Z');
    expect(get('r1')?.lastModified).toBe('2024-06-01T00:00:00.000Z');
  });

  it('skips repos that already have a dateCreated, so it is safe to re-run', async () => {
    const { sink, updateRepo, get } = makeSink(
      [{ _id: 'r1', dateCreated: '2019-05-05T00:00:00.000Z' }],
      () => '2020-01-01T00:00:00.000Z',
    );

    await populateRepoDates.up(sink);

    expect(updateRepo).not.toHaveBeenCalled();
    expect(get('r1')?.dateCreated).toBe('2019-05-05T00:00:00.000Z');
  });

  it('backfills only the repos that need it', async () => {
    const { sink, updateRepo, get } = makeSink(
      [{ _id: 'r1' }, { _id: 'r2', dateCreated: '2019-05-05T00:00:00.000Z' }, { _id: 'r3' }],
      (id) => `2020-01-0${id === 'r1' ? 1 : 3}T00:00:00.000Z`,
    );

    await populateRepoDates.up(sink);

    expect(updateRepo).toHaveBeenCalledTimes(2);
    expect(get('r1')?.dateCreated).toBe('2020-01-01T00:00:00.000Z');
    expect(get('r2')?.dateCreated).toBe('2019-05-05T00:00:00.000Z');
    expect(get('r3')?.dateCreated).toBe('2020-01-03T00:00:00.000Z');
  });

  it('down clears both timestamps', async () => {
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

    await populateRepoDates.down!(sink);

    expect(get('r1')?.dateCreated).toBeUndefined();
    expect(get('r1')?.lastModified).toBeUndefined();
  });
});
