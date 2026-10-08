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

import { describe, expect, it } from 'vitest';
import * as pushes from '../../../src/db/postgres/pushes';
import { definePushStorageContract } from '../pushStorage.contract';
import { query } from '../../../src/db/postgres/helper';
import { Action, RequestType, Step } from '../../../src/proxy/actions';

describe.runIf(process.env.RUN_POSTGRES_TESTS === 'true')('PostgreSQL storage contract', () => {
  definePushStorageContract('PostgreSQL push storage', pushes, async (id) => {
    const result = await query<{ data: unknown }>('SELECT data FROM pushes WHERE id = $1', [id]);
    return result.rows[0]?.data;
  });

  it('reads historical final steps without rewriting the stored audit', async () => {
    const action = new Action('legacy', RequestType.PUSH, 'POST', 123, 'https://example.com/a/b');
    action.addStep(new Step('diff', false, null, false, null, 'legacy diff'));
    const data = JSON.parse(JSON.stringify(action));
    await query('INSERT INTO pushes (id, timestamp, type, data) VALUES ($1, $2, $3, $4)', [
      action.id,
      action.timestamp,
      action.type,
      data,
    ]);
    expect(await pushes.getPush(action.id)).toMatchObject(data);
    expect(
      (await query('SELECT data FROM pushes WHERE id = $1', [action.id])).rows[0].data,
    ).toEqual(data);
    const [summary] = await pushes.getPushes({});
    expect(summary).not.toHaveProperty('lastStep');
    expect(summary).not.toHaveProperty('steps');
  });

  it('preserves explicit null metadata while omitting absent fields', async () => {
    const action = new Action('metadata', RequestType.PUSH, 'POST', 123, 'https://example.com/a/b');
    Object.assign(action, { author: null });
    delete action.rejection;
    await pushes.writeAudit(action);
    const [summary] = await pushes.getPushes({});
    expect(summary).toHaveProperty('author', null);
    expect(summary).not.toHaveProperty('rejection');
  });
});
