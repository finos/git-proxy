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

import { activityPrimaryStatusFromFlags } from '../../activity/activityPrimaryStatus';
import { canonicalRemoteUrl } from '../../activity/canonicalRemoteUrl';
import { Action } from '../../proxy/actions';
import { CompletedAttestation, Rejection } from '../../proxy/processors/types';
import { toClass } from '../helper';
import {
  emptyRepoActivityTabCounts,
  PushQuery,
  RepoActivityTabCounts,
  RepoPushRollupsByCanonicalUrl,
} from '../types';
import { query } from './helper';

const defaultPushQuery: Partial<PushQuery> = {
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
  type: 'push',
};

// Columns that mirror Action fields used to filter `getPushes` results.
// Anything not in this map is ignored — the API only filters by these.
const FILTER_COLUMNS: Record<string, string> = {
  error: 'error',
  blocked: 'blocked',
  allowPush: 'allow_push',
  authorised: 'authorised',
  canceled: 'canceled',
  rejected: 'rejected',
  type: 'type',
};

const rowToAction = (row: { data: unknown }): Action =>
  toClass(row.data, Action.prototype) as Action;

function bumpCount(
  m: Map<string, RepoActivityTabCounts>,
  canonicalKey: string,
  tab: keyof RepoActivityTabCounts,
): void {
  if (!canonicalKey) {
    return;
  }
  let row = m.get(canonicalKey);
  if (!row) {
    row = emptyRepoActivityTabCounts();
    m.set(canonicalKey, row);
  }
  row[tab] += 1;
}

function bumpMaxTimestampMs(
  m: Map<string, number>,
  canonicalKey: string,
  timestamp: unknown,
): void {
  if (!canonicalKey) {
    return;
  }
  // `timestamp` is a BIGINT column, which node-postgres returns as a string.
  // Anything else (null, undefined, empty) is not a usable timestamp.
  const ts =
    typeof timestamp === 'number'
      ? timestamp
      : typeof timestamp === 'string' && timestamp.trim() !== ''
        ? Number(timestamp)
        : NaN;
  if (!Number.isFinite(ts)) {
    return;
  }
  const prev = m.get(canonicalKey);
  if (prev === undefined || ts > prev) {
    m.set(canonicalKey, ts);
  }
}

/**
 * Scan all push rows: tab counts and max timestamps per canonical remote URL
 * (matches the Activity UI). The URL lives inside the `data` JSONB payload, and
 * canonicalization happens in Node so the result matches the mongo and fs
 * backends exactly.
 */
export const getRepoPushRollupsByCanonicalUrl =
  async (): Promise<RepoPushRollupsByCanonicalUrl> => {
    const result = await query<{
      url: string | null;
      error: boolean;
      rejected: boolean;
      canceled: boolean;
      authorised: boolean;
      blocked: boolean;
      allow_push: boolean;
      timestamp: string | number | null;
    }>(
      `SELECT data->>'url' AS url, error, rejected, canceled, authorised, blocked,
              allow_push, timestamp
         FROM pushes
        WHERE type = 'push'`,
    );

    const tabCounts = new Map<string, RepoActivityTabCounts>();
    const latestPendingReviewAtMs = new Map<string, number>();
    const latestPushAtMs = new Map<string, number>();

    for (const row of result.rows) {
      const url = typeof row.url === 'string' ? row.url : '';
      const key = canonicalRemoteUrl(url);
      if (!key) {
        continue;
      }
      const tab = activityPrimaryStatusFromFlags({
        error: row.error === true,
        rejected: row.rejected === true,
        canceled: row.canceled === true,
        authorised: row.authorised === true,
        blocked: row.blocked === true,
        allowPush: row.allow_push === true,
      });
      bumpCount(tabCounts, key, tab);
      bumpMaxTimestampMs(latestPushAtMs, key, row.timestamp);
      if (tab === 'pending') {
        bumpMaxTimestampMs(latestPendingReviewAtMs, key, row.timestamp);
      }
    }

    return { tabCounts, latestPendingReviewAtMs, latestPushAtMs };
  };

/**
 * Pushes shown on a user profile: those the user made (any known email variant)
 * plus those they reviewed. Mirrors `buildUserProfilePushFilter`, which the
 * mongo and fs backends feed to their query engines; the reviewer match is
 * case-insensitive on the exact username.
 */
export const getPushesForUserProfile = async (
  emailVariants: string[],
  profileUsername: string,
): Promise<Action[]> => {
  const reviewerClause = `lower(data->'attestation'->'reviewer'->>'username') = lower($1)`;
  const values: unknown[] = [profileUsername];
  let predicate = reviewerClause;

  if (emailVariants.length > 0) {
    values.push(emailVariants);
    predicate = `((data->>'userEmail') = ANY($${values.length}::text[]) OR ${reviewerClause})`;
  }

  const result = await query<{ data: unknown }>(
    `SELECT data FROM pushes WHERE type = 'push' AND ${predicate} ORDER BY timestamp DESC`,
    values,
  );
  return result.rows.map(rowToAction);
};

export const getPushes = async (q: Partial<PushQuery> = defaultPushQuery): Promise<Action[]> => {
  const clauses: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(q)) {
    const column = FILTER_COLUMNS[key];
    if (!column || value === undefined) continue;
    values.push(value);
    clauses.push(`${column} = $${values.length}`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query<{ data: unknown }>(
    `SELECT data FROM pushes ${where} ORDER BY timestamp DESC`,
    values,
  );
  return result.rows.map(rowToAction);
};

export const getPush = async (id: string): Promise<Action | null> => {
  const result = await query<{ data: unknown }>(`SELECT data FROM pushes WHERE id = $1`, [id]);
  if (result.rowCount === 0) return null;
  return rowToAction(result.rows[0]);
};

export const deletePush = async (id: string): Promise<void> => {
  await query(`DELETE FROM pushes WHERE id = $1`, [id]);
};

export const writeAudit = async (action: Action): Promise<void> => {
  if (typeof action.id !== 'string') {
    throw new Error('Invalid id');
  }

  // Round-trip through JSON to drop class identity / mongo-specific _id fields
  // before persisting (mirrors mongo's `JSON.parse(JSON.stringify(action))`).
  const data = JSON.parse(JSON.stringify(action));
  delete data._id;

  await query(
    `INSERT INTO pushes (
       id, timestamp, type, error, blocked, allow_push,
       authorised, canceled, rejected, data
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       timestamp = EXCLUDED.timestamp,
       type = EXCLUDED.type,
       error = EXCLUDED.error,
       blocked = EXCLUDED.blocked,
       allow_push = EXCLUDED.allow_push,
       authorised = EXCLUDED.authorised,
       canceled = EXCLUDED.canceled,
       rejected = EXCLUDED.rejected,
       data = EXCLUDED.data`,
    [
      action.id,
      action.timestamp ?? Date.now(),
      action.type ?? null,
      action.error ?? false,
      action.blocked ?? false,
      action.allowPush ?? false,
      action.authorised ?? false,
      action.canceled ?? false,
      action.rejected ?? false,
      JSON.stringify(data),
    ],
  );
};

export const authorise = async (
  id: string,
  attestation?: CompletedAttestation,
): Promise<{ message: string }> => {
  const action = await getPush(id);
  if (!action) {
    throw new Error(`push ${id} not found`);
  }
  action.authorised = true;
  action.canceled = false;
  action.rejected = false;
  action.attestation = attestation;
  await writeAudit(action);
  return { message: `authorised ${id}` };
};

export const reject = async (id: string, rejection: Rejection): Promise<{ message: string }> => {
  const action = await getPush(id);
  if (!action) {
    throw new Error(`push ${id} not found`);
  }
  action.authorised = false;
  action.canceled = false;
  action.rejected = true;
  // Preserve the existing rejection-payload shape used by the fs/mongo
  // backends — the issue calls this out explicitly as a must-fix.
  action.rejection = rejection;
  await writeAudit(action);
  return { message: `reject ${id}` };
};

export const cancel = async (id: string): Promise<{ message: string }> => {
  const action = await getPush(id);
  if (!action) {
    throw new Error(`push ${id} not found`);
  }
  action.authorised = false;
  action.canceled = true;
  action.rejected = false;
  await writeAudit(action);
  return { message: `canceled ${id}` };
};
