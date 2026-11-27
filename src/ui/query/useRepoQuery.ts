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
import { useLocation, useNavigate } from 'react-router';
import { loginPathWithRedirect } from '../utils/postLoginRedirect';
import { getRepo } from '../services/repo';
import { repoQueryKeys } from './repoQueryKeys';
import { RepoView } from '../types';

export async function fetchRepo(
  id: string,
  navigate: (path: string, opts?: object) => void,
  location?: { pathname: string; search: string; hash: string },
): Promise<RepoView> {
  const result = await getRepo(id);
  if (result.success && result.data) {
    return result.data;
  }
  if (result.status === 401) {
    navigate(location ? loginPathWithRedirect(location) : '/login', { replace: true });
  }
  throw new Error(result.message || 'Failed to load repository');
}

export function useRepoQuery(id: string | undefined) {
  const navigate = useNavigate();
  const location = useLocation();

  return useQuery<RepoView>({
    queryKey: repoQueryKeys.detail(id ?? ''),
    queryFn: () => fetchRepo(id!, navigate, location),
    enabled: Boolean(id),
  });
}
