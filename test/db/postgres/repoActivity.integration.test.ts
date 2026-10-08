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

import { describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import * as pushes from '../../../src/db/postgres/pushes';
import { connect, query, resetConnection, withTransaction } from '../../../src/db/postgres/helper';
import { MIGRATIONS, runMigrations } from '../../../src/db/postgres/schemaMigrations';
import { rebuildRepoPushRollups } from '../../../src/db/postgres/repoActivity';
import { defineRepoActivityContract } from '../repoActivity.contract';
import { Action, RequestType, Step } from '../../../src/proxy/actions';

const key = 'example.com/activity/repo';
const makePush = (id = 'activity') => {
  const action = new Action(id, RequestType.PUSH, 'POST', 123, `https://${key}.git`);
  action.blocked = true;
  action.addStep(new Step('diff', false, null, false, null, 'private audit payload'));
  return action;
};

describe.runIf(process.env.RUN_POSTGRES_TESTS === 'true')('PostgreSQL repository activity', () => {
  defineRepoActivityContract('PostgreSQL repository activity contract', pushes);

  it('serves warm summaries without accessing push audit records', async () => {
    await pushes.writeAudit(makePush());
    await pushes.getRepoPushRollupsByCanonicalUrl();
    await query('ALTER TABLE pushes RENAME TO temporarily_hidden_pushes');
    try {
      const rollups = await pushes.getRepoPushRollupsByCanonicalUrl();
      expect(rollups.tabCounts.get(key)?.pending).toBe(1);
      expect(rollups.latestPushAtMs.get(key)).toBe(123);
    } finally {
      await query('ALTER TABLE temporarily_hidden_pushes RENAME TO pushes');
    }
    const metadata = await query('SELECT * FROM push_activity');
    expect(JSON.stringify(metadata.rows)).not.toContain('private audit payload');
    expect((await pushes.getPush('activity'))?.steps[0].content).toBe('private audit payload');
  });

  it('does not record rolled-back audit writes', async () => {
    await expect(
      withTransaction(async (client) => {
        await client.query(
          'INSERT INTO pushes (id, timestamp, type, data) VALUES ($1, $2, $3, $4)',
          ['rolled-back', 123, 'push', JSON.stringify(makePush('rolled-back'))],
        );
        throw new Error('audit failed');
      }),
    ).rejects.toThrow('audit failed');
    expect(await pushes.getPush('rolled-back')).toBeNull();
    expect((await query('SELECT * FROM push_activity_changes')).rows).toEqual([]);
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.size).toBe(0);
  });

  it('rolls back an interrupted refresh and retries after reconnecting', async () => {
    await pushes.writeAudit(makePush());
    await query(`
      CREATE FUNCTION test_fail_activity_refresh() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'refresh interrupted'; END;
      $$;
      CREATE TRIGGER test_fail_activity_refresh BEFORE INSERT ON repo_push_activity
      FOR EACH ROW EXECUTE FUNCTION test_fail_activity_refresh();
    `);
    try {
      await expect(pushes.getRepoPushRollupsByCanonicalUrl()).rejects.toThrow(
        'refresh interrupted',
      );
      expect((await query('SELECT * FROM push_activity')).rows).toEqual([]);
      expect((await query('SELECT id FROM push_activity_changes')).rows).toEqual([
        { id: 'activity' },
      ]);
      expect((await pushes.getPush('activity'))?.steps[0].content).toBe('private audit payload');
    } finally {
      await query(
        'DROP TRIGGER test_fail_activity_refresh ON repo_push_activity; DROP FUNCTION test_fail_activity_refresh()',
      );
    }
    await resetConnection();
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.pending).toBe(1);
  });

  it('retains a newer change committed while a refresh is paused', async () => {
    await pushes.writeAudit(makePush());
    const gate = await (await connect()).connect();
    await query(`
      CREATE FUNCTION test_pause_activity_refresh() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_advisory_xact_lock(16911795); RETURN NEW; END;
      $$;
      CREATE TRIGGER test_pause_activity_refresh BEFORE INSERT ON push_activity
      FOR EACH ROW EXECUTE FUNCTION test_pause_activity_refresh();
    `);
    await gate.query('BEGIN');
    await gate.query('SELECT pg_advisory_xact_lock(16911795)');
    const refresh = pushes.getRepoPushRollupsByCanonicalUrl();
    const settled = refresh.then(
      (value) => ({ value, error: null }),
      (error: unknown) => ({ value: null, error }),
    );
    try {
      await vi.waitFor(
        async () => {
          const waiting = await query(`SELECT 1 FROM pg_stat_activity
          WHERE wait_event = 'advisory' AND query LIKE '%INSERT INTO push_activity (id,%'`);
          expect(waiting.rowCount).toBe(1);
        },
        { timeout: 5000, interval: 10 },
      );
      await pushes.authorise('activity');
    } finally {
      await gate.query('COMMIT');
      gate.release();
      await settled;
      await query(
        'DROP TRIGGER test_pause_activity_refresh ON push_activity; DROP FUNCTION test_pause_activity_refresh()',
      );
    }
    expect((await settled).error).toBeNull();
    expect((await query('SELECT id FROM push_activity_changes')).rows).toEqual([
      { id: 'activity' },
    ]);
    const current = await pushes.getRepoPushRollupsByCanonicalUrl();
    expect(current.tabCounts.get(key)?.approved).toBe(1);
    expect(current.tabCounts.get(key)?.pending).toBe(0);
    expect((await query('SELECT * FROM push_activity_changes')).rows).toEqual([]);
  });

  it('serializes concurrent refreshes and counts repeated writes once', async () => {
    await Promise.all(Array.from({ length: 10 }, () => pushes.writeAudit(makePush())));
    const rollups = await Promise.all(
      Array.from({ length: 10 }, () => pushes.getRepoPushRollupsByCanonicalUrl()),
    );
    for (const rollup of rollups) expect(rollup.tabCounts.get(key)?.pending).toBe(1);
    expect((await query('SELECT id FROM push_activity')).rows).toEqual([{ id: 'activity' }]);
  });

  it('handles deletion and recreation before a refresh', async () => {
    await pushes.writeAudit(makePush());
    await pushes.getRepoPushRollupsByCanonicalUrl();
    await pushes.deletePush('activity');
    const replacement = makePush();
    replacement.authorised = true;
    replacement.timestamp = 456;
    await pushes.writeAudit(replacement);
    const rollup = await pushes.getRepoPushRollupsByCanonicalUrl();
    expect(rollup.tabCounts.get(key)?.approved).toBe(1);
    expect(rollup.tabCounts.get(key)?.pending).toBe(0);
    expect(rollup.latestPushAtMs.get(key)).toBe(456);
  });

  it('rebuilds deleted summaries from source records', async () => {
    await pushes.writeAudit(makePush());
    await pushes.getRepoPushRollupsByCanonicalUrl();
    await query('DELETE FROM repo_push_activity');
    expect((await rebuildRepoPushRollups()).tabCounts.get(key)?.pending).toBe(1);
    expect((await query('SELECT * FROM push_activity_changes')).rows).toEqual([]);
  });

  it('processes non-push records without creating activity', async () => {
    const action = makePush();
    action.type = RequestType.PULL;
    await pushes.writeAudit(action);
    expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.size).toBe(0);
    expect((await query('SELECT * FROM push_activity_changes')).rows).toEqual([]);
    expect(await pushes.getPush(action.id)).not.toBeNull();
  });

  it('backfills version 8 records without changing audit data', async () => {
    const pool = new Pool({
      connectionString:
        process.env.GIT_PROXY_POSTGRES_CONNECTION_STRING ||
        'postgresql://postgres:postgres@localhost:5432/git_proxy_test',
    });
    await resetConnection();
    try {
      await pool.query(`DROP TABLE IF EXISTS schema_migrations, push_activity_changes, push_activity,
        repo_push_activity, repo_users, pushes, repos, users CASCADE`);
      await pool.query(
        'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL)',
      );
      for (const migration of MIGRATIONS.filter((entry) => entry.version <= 8)) {
        await pool.query(migration.sql);
        await pool.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
          migration.version,
          migration.name,
        ]);
      }
      const action = makePush();
      const data = JSON.parse(JSON.stringify(action));
      await pool.query(
        'INSERT INTO pushes (id, timestamp, type, blocked, data) VALUES ($1, $2, $3, $4, $5)',
        [action.id, action.timestamp, action.type, action.blocked, data],
      );
      await runMigrations(pool);
      expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.pending).toBe(1);
      expect(
        (await query('SELECT data FROM pushes WHERE id = $1', [action.id])).rows[0].data,
      ).toEqual(data);
      await runMigrations(pool);
      expect((await pushes.getRepoPushRollupsByCanonicalUrl()).tabCounts.get(key)?.pending).toBe(1);
    } finally {
      await pool.end();
    }
  });
});
