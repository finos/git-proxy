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
import { useNavigate } from 'react-router';
import { getPush } from '../services/git-push';
import { pushQueryKeys } from './pushQueryKeys';
import { PushActionView } from '../types';

export function usePushQuery(id: string | undefined) {
  const navigate = useNavigate();

  return useQuery<PushActionView>({
    queryKey: pushQueryKeys.detail(id ?? ''),
    queryFn: async () => {
      const result = await getPush(id!);
      if (result.success && result.data) {
        return result.data;
      }
      if (result.status === 401) {
        navigate('/login', { replace: true });
      }
      throw new Error(result.message || 'Failed to load push');
    },
    enabled: Boolean(id),
  });
}
