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

import type { PoolClient } from 'pg';
import { withTransaction } from './helper';
import {
  pushActivity,
  repoRollups,
  type PushActivityRow,
  type RepoActivitySummary,
} from '../repoActivity';

type ChangedPush = {
  id: string;
  revision: string;
  previous_key: string | null;
  data: PushActivityRow | null;
};

const ACTIVITY_LOCK = 16911794;

const refreshActivity = async (client: PoolClient): Promise<void> => {
  const pending = await client.query<{ pending: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM push_activity_changes) AS pending',
  );
  if (!pending.rows[0].pending) return;

  const { rows } = await client.query<ChangedPush>(`
    SELECT change.id, change.revision::text, previous.key AS previous_key,
      CASE WHEN push.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', push.id, 'type', push.type, 'url', push.data->'url',
        'timestamp', push.data->'timestamp', 'error', push.error,
        'rejected', push.rejected, 'canceled', push.canceled,
        'authorised', push.authorised, 'blocked', push.blocked, 'allowPush', push.allow_push
      ) END AS data
    FROM push_activity_changes AS change
    LEFT JOIN pushes AS push ON push.id = change.id
    LEFT JOIN push_activity AS previous ON previous.id = change.id
  `);
  const keys = new Set<string>();
  const contributions = [];
  for (const row of rows) {
    if (row.previous_key) keys.add(row.previous_key);
    const activity = row.data ? pushActivity(row.data) : null;
    if (activity) {
      keys.add(activity.key);
      contributions.push({ id: row.id, ...activity });
    }
  }
  await client.query('DELETE FROM push_activity WHERE id = ANY($1::text[])', [
    rows.map((row) => row.id),
  ]);
  if (contributions.length) {
    await client.query(
      `
      INSERT INTO push_activity (id, key, tab, timestamp)
      SELECT id, key, tab, timestamp FROM jsonb_to_recordset($1::jsonb)
        AS activity(id text, key text, tab text, timestamp double precision)
    `,
      [JSON.stringify(contributions)],
    );
  }
  if (keys.size) {
    await client.query('DELETE FROM repo_push_activity WHERE key = ANY($1::text[])', [[...keys]]);
    await client.query(
      `
      INSERT INTO repo_push_activity (key, counts, latest_push, latest_pending)
      SELECT key, jsonb_build_object(
        'pending', count(*) FILTER (WHERE tab = 'pending'),
        'approved', count(*) FILTER (WHERE tab = 'approved'),
        'rejected', count(*) FILTER (WHERE tab = 'rejected'),
        'canceled', count(*) FILTER (WHERE tab = 'canceled'),
        'error', count(*) FILTER (WHERE tab = 'error')
      ), max(timestamp), max(timestamp) FILTER (WHERE tab = 'pending')
      FROM push_activity WHERE key = ANY($1::text[]) GROUP BY key
    `,
      [[...keys]],
    );
  }
  // A source write and its change marker commit together; newer revisions must survive this refresh.
  await client.query(
    `
    DELETE FROM push_activity_changes AS change
    USING jsonb_to_recordset($1::jsonb) AS processed(id text, revision uuid)
    WHERE change.id = processed.id AND change.revision = processed.revision
  `,
    [JSON.stringify(rows.map(({ id, revision }) => ({ id, revision })))],
  );
};

const readSummaries = async (client: PoolClient) => {
  const { rows } = await client.query<RepoActivitySummary>(`
    SELECT key, counts, latest_push AS "latestPush", latest_pending AS "latestPending"
    FROM repo_push_activity
  `);
  return repoRollups(rows);
};

export const getRepoPushRollupsByCanonicalUrl = () =>
  withTransaction(async (client) => {
    // Serialize refreshers; source rows are read through MVCC.
    await client.query('SELECT pg_advisory_xact_lock($1)', [ACTIVITY_LOCK]);
    await refreshActivity(client);
    return readSummaries(client);
  });

export const rebuildRepoPushRollups = () =>
  withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [ACTIVITY_LOCK]);
    await client.query('DELETE FROM push_activity');
    await client.query('DELETE FROM repo_push_activity');
    await client.query(`
      INSERT INTO push_activity_changes (id) SELECT id FROM pushes
      ON CONFLICT (id) DO UPDATE SET revision = EXCLUDED.revision
    `);
    await refreshActivity(client);
    return readSummaries(client);
  });
