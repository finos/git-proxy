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

import type { Action } from '../proxy/actions';

/**
 * List and profile responses contain metadata only. Keep every diff representation
 * (steps, lastStep, and the proposed top-level diff) out of this allowlist.
 * Detail reads and audit writes retain the complete record.
 */
export const pushListProjection = {
  _id: 0,
  actionType: 1,
  allowPush: 1,
  attestation: 1,
  author: 1,
  authorised: 1,
  autoApproved: 1,
  autoRejected: 1,
  blocked: 1,
  blockedMessage: 1,
  branch: 1,
  canceled: 1,
  commitData: 1,
  commitFrom: 1,
  commitTo: 1,
  error: 1,
  errorMessage: 1,
  id: 1,
  legacyId: 1,
  message: 1,
  method: 1,
  project: 1,
  protocol: 1,
  pusherVerified: 1,
  rejected: 1,
  rejection: 1,
  repo: 1,
  repoName: 1,
  tagData: 1,
  tags: 1,
  timestamp: 1,
  type: 1,
  url: 1,
  user: 1,
  userEmail: 1,
} as const satisfies Partial<Record<keyof Action | '_id', 0 | 1>>;
