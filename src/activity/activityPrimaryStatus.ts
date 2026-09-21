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

/** Activity list status tabs excluding the aggregate `all` tab. */
export type ActivityStatusTab = 'pending' | 'approved' | 'canceled' | 'rejected' | 'error';

/** Minimal push fields used to compute the primary Activity tab bucket. */
export type ActivityPrimaryStatusInput = {
  error?: boolean;
  rejected?: boolean;
  canceled?: boolean;
  authorised?: boolean;
  blocked?: boolean;
  allowPush?: boolean;
};

/**
 * Single status bucket per push so tab counts partition the list (matches Activity UI).
 *
 * Priority: terminal outcomes first, then approved, blocked pending, then `allowPush` as approved;
 * remaining rows default to pending.
 */
export function activityPrimaryStatusFromFlags(row: ActivityPrimaryStatusInput): ActivityStatusTab {
  if (row.error === true) {
    return 'error';
  }
  if (row.rejected === true) {
    return 'rejected';
  }
  if (row.canceled === true) {
    return 'canceled';
  }
  if (row.authorised === true) {
    return 'approved';
  }
  if (row.blocked === true) {
    return 'pending';
  }
  if (row.allowPush === true) {
    return 'approved';
  }
  return 'pending';
}
