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

import { Action } from '../../proxy/actions';
import { CompletedAttestation, Rejection } from '../../proxy/processors/types';
import { toClass } from '../helper';
import { PushQuery } from '../types';
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
