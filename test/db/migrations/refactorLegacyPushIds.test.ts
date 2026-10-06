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
import {
  LEGACY_PUSH_ID,
  refactorLegacyPushIds,
} from '../../../src/db/migrations/refactorLegacyPushIds';
import { Action, buildPushId } from '../../../src/proxy/actions/Action';
import type { Sink } from '../../../src/db/types';
import { EMPTY_COMMIT_HASH } from '../../../src/proxy/constants';

const REPO_1_URL = 'https://example.com/repo1.git';
const REPO_2_URL = 'https://example.com/repo2.git';
const OLD = 'a'.repeat(40);
const NEW = 'b'.repeat(40);

type PushRecord = Record<string, unknown> & { id: string };

const makeSink = (pushes: PushRecord[]) => {
  const store = new Map(pushes.map((p, i) => [p.id, { ...p, _id: `nedb-${i}` }]));
  let nextId = pushes.length;
  const writeAudit = vi.fn(async (action: PushRecord) => {
    const existing = store.get(action.id);
    if (existing) {
      store.set(action.id, { ...existing, ...JSON.parse(JSON.stringify(action)) });
      return;
    }
    if (action._id !== undefined) {
      for (const doc of store.values()) {
        if (doc._id === action._id) {
          throw new Error(`Can't insert key "${action._id}", it violates the unique constraint`);
        }
      }
    }
    store.set(action.id, { ...JSON.parse(JSON.stringify(action)), _id: `nedb-${nextId++}` });
  });
  const deletePush = vi.fn(async (id: string) => {
    store.delete(id);
  });
  const sink = {
    getPushes: async () =>
      [...store.values()].map(({ id, url, branch, commitFrom, commitTo }) => ({
        id,
        url,
        branch,
        commitFrom,
        commitTo,
      })),
    getPush: async (id: string) => {
      const doc = store.get(id);
      return doc ? Object.assign(new Action(id, 'push', 'POST', 0, doc.url as string), doc) : null;
    },
    writeAudit,
    deletePush,
  } as unknown as Sink;
  return {
    sink,
    writeAudit,
    deletePush,
    get: (id: string) => store.get(id),
    ids: () => [...store.keys()].sort(),
  };
};

const legacyBranchPush = (overrides: Partial<PushRecord> = {}): PushRecord => ({
  id: `${OLD}__${NEW}`,
  url: REPO_1_URL,
  branch: 'refs/heads/spike',
  commitFrom: OLD,
  commitTo: NEW,
  authorised: true,
  attestation: { reviewer: { username: 'trent' } },
  steps: [{ stepName: 'diff', content: 'reviewed diff' }],
  ...overrides,
});

describe('rescopePushIds migration', () => {
  it('is registered under a sortable, timestamped id', () => {
    expect(refactorLegacyPushIds.id).toBe('20260914-refactor-legacy-push-ids');
  });

  describe('LEGACY_PUSH_ID', () => {
    it('matches SHA-1 and SHA-256 legacy ids and captures the raw oids', () => {
      expect(LEGACY_PUSH_ID.exec(`${OLD}__${NEW}`)?.slice(1)).toEqual([OLD, NEW]);
      expect(LEGACY_PUSH_ID.test(`${'c'.repeat(64)}__${'d'.repeat(64)}`)).toBe(true);
    });

    it('does not match scoped ids or the timestamp ids of pushes that failed to parse', () => {
      expect(LEGACY_PUSH_ID.test('c'.repeat(64))).toBe(false);
      expect(LEGACY_PUSH_ID.test('1744380874110')).toBe(false);
      expect(LEGACY_PUSH_ID.test(`${OLD}__1744380874110`)).toBe(false);
    });
  });

  it('re-keys a legacy record to the scoped id and preserves the full record', async () => {
    const { sink, get, ids } = makeSink([legacyBranchPush()]);
    const newId = buildPushId({
      url: REPO_1_URL,
      branch: 'refs/heads/spike',
      tags: undefined,
      commitFrom: OLD,
      commitTo: NEW,
    });

    await refactorLegacyPushIds.up(sink);

    expect(ids()).toEqual([newId]);
    const migrated = get(newId);
    expect(migrated?.legacyId).toBe(`${OLD}__${NEW}`);
    expect(migrated?.authorised).toBe(true);
    expect(migrated?.attestation).toEqual({ reviewer: { username: 'trent' } });
    // fields outside the list projection must survive, proving the full record was re-fetched
    expect(migrated?.steps).toEqual([{ stepName: 'diff', content: 'reviewed diff' }]);
  });

  it('builds the scoped id from the raw oids in the legacy id, not the rewritten commitFrom', async () => {
    // parsePush rewrites commitFrom for new branches; the id must use the zero hash sent by git
    const { sink, ids } = makeSink([
      legacyBranchPush({ id: `${EMPTY_COMMIT_HASH}__${NEW}`, commitFrom: 'c'.repeat(40) }),
    ]);

    await refactorLegacyPushIds.up(sink);

    expect(ids()).toEqual([
      buildPushId({
        url: REPO_1_URL,
        branch: 'refs/heads/spike',
        commitFrom: EMPTY_COMMIT_HASH,
        commitTo: NEW,
      }),
    ]);
  });

  it('includes the tags of a tag push in the scoped id', async () => {
    const { sink, ids } = makeSink([
      legacyBranchPush({
        branch: undefined,
        actionType: 'tag',
        tags: ['refs/tags/v2.0.0', 'refs/tags/v1.0.0'],
      }),
    ]);

    await refactorLegacyPushIds.up(sink);

    expect(ids()).toEqual([
      buildPushId({
        url: REPO_1_URL,
        tags: ['refs/tags/v1.0.0', 'refs/tags/v2.0.0'],
        commitFrom: OLD,
        commitTo: NEW,
      }),
    ]);
  });

  it('makes the migrated record discoverable under the id a re-push will compute', async () => {
    const { sink, get } = makeSink([legacyBranchPush()]);

    await refactorLegacyPushIds.up(sink);

    const rePush = new Action('x', 'push', 'POST', 0, REPO_1_URL);
    rePush.branch = 'refs/heads/spike';
    rePush.setCommit(OLD, NEW);
    expect(get(rePush.id)?.authorised).toBe(true);
  });

  it('leaves non-legacy ids alone and is safe to re-run', async () => {
    const scoped = legacyBranchPush({ id: 'c'.repeat(64) });
    const failedToParse = { id: '1744380874110', url: REPO_1_URL, error: true };
    const { sink, writeAudit, deletePush, ids } = makeSink([
      legacyBranchPush(),
      scoped,
      failedToParse,
    ]);

    await refactorLegacyPushIds.up(sink);
    const afterFirstRun = ids();
    expect(afterFirstRun).toHaveLength(3);
    expect(afterFirstRun).toContain('c'.repeat(64));
    expect(afterFirstRun).toContain('1744380874110');
    expect(writeAudit).toHaveBeenCalledTimes(1);
    expect(deletePush).toHaveBeenCalledTimes(1);

    await refactorLegacyPushIds.up(sink);
    expect(ids()).toEqual(afterFirstRun);
    expect(writeAudit).toHaveBeenCalledTimes(1);
  });

  it('never overwrites a push already recorded under the scoped id', async () => {
    const newId = buildPushId({
      url: REPO_1_URL,
      branch: 'refs/heads/spike',
      commitFrom: OLD,
      commitTo: NEW,
    });
    const { sink, writeAudit, deletePush, get } = makeSink([
      legacyBranchPush(),
      legacyBranchPush({ id: newId, authorised: false, steps: [] }),
    ]);

    await refactorLegacyPushIds.up(sink);

    expect(writeAudit).not.toHaveBeenCalled();
    expect(deletePush).not.toHaveBeenCalled();
    expect(get(newId)?.authorised).toBe(false);
    expect(get(`${OLD}__${NEW}`)?.authorised).toBe(true);
  });

  it('keeps pushes of the same commit range to different repositories apart', async () => {
    // only one legacy record could exist for a shared id, but pushes to distinct repositories
    // recorded before and after the upgrade must never converge on the same scoped id
    const { sink, ids } = makeSink([
      legacyBranchPush(),
      legacyBranchPush({
        id: `${OLD}__${'e'.repeat(40)}`,
        url: REPO_2_URL,
        commitTo: 'e'.repeat(40),
      }),
    ]);

    await refactorLegacyPushIds.up(sink);

    const result = ids();
    expect(result).toHaveLength(2);
    expect(result.every((id) => /^[0-9a-f]{64}$/.test(id))).toBe(true);
  });

  it('down restores the legacy id and drops the legacyId marker', async () => {
    const { sink, get, ids } = makeSink([legacyBranchPush()]);
    await refactorLegacyPushIds.up(sink);

    await refactorLegacyPushIds.down!(sink);

    expect(ids()).toEqual([`${OLD}__${NEW}`]);
    const restored = get(`${OLD}__${NEW}`);
    expect(restored?.legacyId).toBeUndefined();
    expect(restored?.authorised).toBe(true);
    expect(restored?.steps).toEqual([{ stepName: 'diff', content: 'reviewed diff' }]);
  });

  it('down leaves records without a legacyId untouched', async () => {
    const { sink, writeAudit, deletePush } = makeSink([
      legacyBranchPush({ id: 'c'.repeat(64) }),
      { id: '1744380874110', url: REPO_1_URL, error: true },
    ]);

    await refactorLegacyPushIds.down!(sink);

    expect(writeAudit).not.toHaveBeenCalled();
    expect(deletePush).not.toHaveBeenCalled();
  });
});
