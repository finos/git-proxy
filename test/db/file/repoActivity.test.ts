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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Action, RequestType } from '../../../src/proxy/actions';

describe('file repository rollup initialization', () => {
  afterEach(() => vi.restoreAllMocks());

  it('retries a failed history load and shares the successful index between readers', async () => {
    vi.resetModules();
    const sink = await import('../../../src/db/file/pushes');
    const action = new Action('history', RequestType.PUSH, 'POST', 123, 'https://example.com/a/b');
    await sink.db.insertAsync(action);
    const failure = new Error('history read failed');
    const original = sink.db.find.bind(sink.db);
    const find = vi
      .spyOn(sink.db, 'find')
      .mockImplementationOnce(
        (query: unknown, projection: unknown, callback?: (error: Error, rows: never[]) => void) => {
          queueMicrotask(() => callback?.(failure, []));
          return original(query, projection);
        },
      );
    await expect(sink.getRepoPushRollupsByCanonicalUrl()).rejects.toThrow(failure);
    const readers = await Promise.all([
      sink.getRepoPushRollupsByCanonicalUrl(),
      sink.getRepoPushRollupsByCanonicalUrl(),
    ]);
    for (const rollups of readers) {
      expect(rollups.tabCounts.get('example.com/a/b')?.pending).toBe(1);
      expect(rollups.latestPushAtMs.get('example.com/a/b')).toBe(123);
    }
    expect(find).toHaveBeenCalledTimes(2);
  });

  it('loads historical rows once and applies writes after initialization', async () => {
    vi.resetModules();
    const sink = await import('../../../src/db/file/pushes');
    const action = new Action('history', RequestType.PUSH, 'POST', 123, 'https://example.com/a/b');
    action.blocked = true;
    await sink.db.insertAsync(action);
    expect(
      (await sink.getRepoPushRollupsByCanonicalUrl()).tabCounts.get('example.com/a/b')?.pending,
    ).toBe(1);
    await sink.authorise(action.id);
    const find = vi.spyOn(sink.db, 'find');
    const rollups = await sink.getRepoPushRollupsByCanonicalUrl();
    expect(rollups.tabCounts.get('example.com/a/b')?.approved).toBe(1);
    expect(rollups.latestPendingReviewAtMs.has('example.com/a/b')).toBe(false);
    expect(find).not.toHaveBeenCalled();
  });

  it('does not change a warm index when a database write fails', async () => {
    vi.resetModules();
    const sink = await import('../../../src/db/file/pushes');
    const action = new Action('failure', RequestType.PUSH, 'POST', 123, 'https://example.com/a/b');
    await sink.writeAudit(action);
    await sink.getRepoPushRollupsByCanonicalUrl();
    const update = vi.spyOn(sink.db, 'update').mockImplementationOnce(() => {
      throw new Error('write failed');
    });
    await expect(sink.authorise(action.id)).rejects.toThrow('write failed');
    update.mockRestore();
    expect(
      (await sink.getRepoPushRollupsByCanonicalUrl()).tabCounts.get('example.com/a/b')?.pending,
    ).toBe(1);
    expect((await sink.getPush(action.id))?.authorised).toBe(false);
  });
});
