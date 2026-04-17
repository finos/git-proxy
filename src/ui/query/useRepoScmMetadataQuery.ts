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
import { getRepoScmMetadata } from '../services/repo';
import { SCMRepositoryMetadata } from '../types';
import { repoQueryKeys } from './repoQueryKeys';

/** Aligns loosely with server SCM metadata success TTL (see `scmMetadata.ts`). */
const SCM_METADATA_STALE_MS = 6 * 60 * 60 * 1000;

export function useRepoScmMetadataQuery(repoId: string | undefined) {
  return useQuery({
    queryKey: repoQueryKeys.scmMetadata(repoId ?? ''),
    queryFn: async (): Promise<SCMRepositoryMetadata | null> => {
      if (!repoId) {
        return null;
      }
      const result = await getRepoScmMetadata(repoId);
      if (result.success) {
        return result.data ?? null;
      }
      console.warn(`Unable to load SCM metadata for repo ${repoId}:`, result.message ?? '');
      return null;
    },
    enabled: Boolean(repoId),
    staleTime: SCM_METADATA_STALE_MS,
  });
}
