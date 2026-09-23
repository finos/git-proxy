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

/**
 * This action checks whether a push was previously authorised (and thus
 * can be allowed to go through to the actual remote).
 *
 * Commit/tag fingerprints are needed to compare that the push really is
 * the exact one that was authorised (rather than a forged push with same id)
 */

import { Request } from 'express';

import { Action, Step } from '../../actions';
import { CommitData } from '../types';
import { TagData } from '../../../types/models';
import { getPush } from '../../../db';
import { getErrorMessage } from '../../../utils/errors';

const commitFingerprint = (c: CommitData): string =>
  JSON.stringify([
    c.tree,
    c.parent,
    c.author,
    c.authorEmail,
    c.committer,
    c.committerEmail,
    c.commitTimestamp,
    c.message,
  ]);

const tagFingerprint = (t: TagData): string =>
  JSON.stringify([t.object, t.type, t.tagName, t.tagger, t.taggerEmail, t.timestamp, t.message]);

const isSubset = (subset: string[], superset: string[]): boolean => {
  const remaining = new Map<string, number>();
  for (const item of superset) remaining.set(item, (remaining.get(item) ?? 0) + 1);
  for (const item of subset) {
    const count = remaining.get(item) ?? 0;
    if (count === 0) return false;
    remaining.set(item, count - 1);
  }
  return true;
};

/**
 * Check that a stored (previously approved) push actually represents
 * the push currently being processed.
 *
 * @param {Action} approved The previously authorised push
 * @param {Action} incoming The push currently being processed
 * @return {boolean} true if the approval applies to the incoming push
 */
export const pushWasApproved = (approved: Action, incoming: Action): boolean => {
  if (approved.url !== incoming.url) return false;
  if ((approved.actionType ?? null) !== (incoming.actionType ?? null)) return false;
  if ((approved.branch ?? null) !== (incoming.branch ?? null)) return false;
  if ((approved.commitTo ?? null) !== (incoming.commitTo ?? null)) return false;

  const approvedTags = [...(approved.tags ?? [])].sort();
  const incomingTags = [...(incoming.tags ?? [])].sort();
  if (JSON.stringify(approvedTags) !== JSON.stringify(incomingTags)) return false;

  const commitsCovered = isSubset(
    (incoming.commitData ?? []).map(commitFingerprint),
    (approved.commitData ?? []).map(commitFingerprint),
  );
  const tagsCovered = isSubset(
    (incoming.tagData ?? []).map(tagFingerprint),
    (approved.tagData ?? []).map(tagFingerprint),
  );
  return commitsCovered && tagsCovered;
};

// Execute function
const exec = async (_req: Request, action: Action): Promise<Action> => {
  const step = new Step('checkIfWaitingAuth');
  try {
    const existingAction = await getPush(action.id);
    if (existingAction && !action.error && existingAction.authorised) {
      if (pushWasApproved(existingAction, action)) {
        action = existingAction;
        action.setAllowPush();
      } else {
        step.log(
          `${action.id} was approved for another repository, ref or commit range and doesn't apply to this push.`,
        );
      }
    }
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    step.setError(msg);
    throw error;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'checkIfWaitingAuth.exec';

export { exec };
