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

import type { Migration } from './index';
import type { Sink } from '../types';
import { Action, buildPushId } from '../../proxy/actions/Action';

/**
 * Legacy push ID format: `<oldOid>__<newOid>` with SHA-1 (40) or SHA-256 (64) hex object IDs
 */
export const LEGACY_PUSH_ID = /^([0-9a-f]{40}|[0-9a-f]{64})__([0-9a-f]{40}|[0-9a-f]{64})$/;

/**
 * Store push under its new ID as a new record
 * @param {Sink} sink The database sink
 * @param {Action} push The push to write, already carrying its new id
 */
const writeAsNewRecord = async (sink: Sink, push: Action): Promise<void> => {
  delete (push as Action & { _id?: unknown })._id;
  await sink.writeAudit(push);
};

/**
 * Re-keys pushes recorded under the legacy `commitFrom__commitTo` id to the scoped id
 * derived from repository URL, ref(s) and commit range, so that pushes pending or approved
 * at upgrade time are still matched when the contributor pushes again.
 *
 * Reads the full record through `getPush` (the list projection is partial on Mongo), writes it
 * back under the new id with `legacyId` preserved for rollback, then deletes the old record.
 * A legacy record is left untouched when a push has already been recorded under its scoped id
 * (received after the upgrade), so the migration never overwrites live state. Records whose id
 * is not in the legacy format (e.g. pushes that failed before the commit range was parsed) are
 * skipped, which also makes the migration safe to re-run.
 */
export const refactorLegacyPushIds: Migration = {
  id: '20260914-refactor-legacy-push-ids',

  up: async (sink) => {
    const pushes = await sink.getPushes({});
    for (const summary of pushes) {
      const match = LEGACY_PUSH_ID.exec(summary.id ?? '');
      if (!match) {
        continue;
      }
      const push = await sink.getPush(summary.id);
      if (!push) {
        continue;
      }
      const [, commitFrom, commitTo] = match;
      const newId = buildPushId({
        url: push.url,
        branch: push.branch,
        tags: push.tags,
        commitFrom,
        commitTo,
      });
      if (await sink.getPush(newId)) {
        console.log(
          `refactor-legacy-push-ids: push ${push.id} already has a record under its new ID ${newId}, legacy record left in place`,
        );
        continue;
      }
      push.legacyId = push.id;
      push.id = newId;
      await writeAsNewRecord(sink, push);
      await sink.deletePush(push.legacyId);
    }
  },

  down: async (sink) => {
    const pushes = await sink.getPushes({});
    for (const summary of pushes) {
      if (!summary.id || LEGACY_PUSH_ID.test(summary.id)) {
        continue;
      }
      const push = await sink.getPush(summary.id);
      if (!push?.legacyId) {
        continue;
      }
      if (await sink.getPush(push.legacyId)) {
        console.log(
          `refactor-legacy-push-ids: push ${push.id} already has a record under its legacy id ${push.legacyId}, new record left in place`,
        );
        continue;
      }
      const newId = push.id;
      push.id = push.legacyId;
      delete push.legacyId;
      await writeAsNewRecord(sink, push);
      await sink.deletePush(newId);
    }
  },
};
