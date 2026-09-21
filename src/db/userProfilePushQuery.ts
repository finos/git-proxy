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

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildUserProfilePushFilter(
  emailVariants: string[],
  profileUsername: string,
): Record<string, unknown> {
  const escaped = escapeRegex(profileUsername);
  const reviewerClause = { 'attestation.reviewer.username': new RegExp(`^${escaped}$`, 'i') };
  if (emailVariants.length === 0) {
    return { type: 'push', ...reviewerClause };
  }
  return {
    type: 'push',
    $or: [{ userEmail: { $in: emailVariants } }, reviewerClause],
  };
}

export function collectUserProfileEmailVariants(user: {
  email?: string | null;
  externalEmail?: string | null;
}): string[] {
  const set = new Set<string>();
  for (const raw of [user.email, user.externalEmail]) {
    if (raw == null || typeof raw !== 'string') continue;
    const t = raw.trim();
    if (!t) continue;
    set.add(t);
    set.add(t.toLowerCase());
  }
  return Array.from(set);
}
