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
import { getUserActivity } from '../services/git-push';
import { userQueryKeys } from './userQueryKeys';
import { PushActionView } from '../types';

export function useUserActivityQuery(username: string | undefined) {
  return useQuery<PushActionView[]>({
    queryKey: userQueryKeys.activity(username ?? ''),
    queryFn: async () => {
      const result = await getUserActivity(username!);
      if (result.success && result.data) {
        return result.data;
      }
      throw new Error(result.message || 'Failed to load user activity');
    },
    enabled: Boolean(username),
  });
}
