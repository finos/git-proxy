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

import { useQuery } from '@tanstack/react-query';
import { resolveUsernameByEmail } from '../services/user';
import { userQueryKeys } from './userQueryKeys';

/** Email→username mappings change rarely; cache indefinitely within a session. */
const USERNAME_BY_EMAIL_STALE_MS = Infinity;

export function useUsernameByEmailQuery(email: string | undefined) {
  return useQuery<string | null>({
    queryKey: userQueryKeys.byEmail(email ?? ''),
    queryFn: async () => {
      const result = await resolveUsernameByEmail(email!);
      return result.success ? (result.data ?? null) : null;
    },
    enabled: Boolean(email),
    staleTime: USERNAME_BY_EMAIL_STALE_MS,
  });
}
