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

import { trimTrailingDotGit } from '../db/helper';
import { getGitProvider } from './gitProviders';
import type { SCMRepositoryMetadata } from './gitProviders';

export type { SCMRepositoryMetadata };

/** Repo card enrichment (description, language, license, fork, avatars) changes slowly. */
const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
/** Cooldown after a failed fetch before treating cache as stale again. */
const FAILURE_TTL_MS = 15 * 60 * 1000;

export const scmMetadataTtls = {
  successMs: SUCCESS_TTL_MS,
  failureMs: FAILURE_TTL_MS,
} as const;

/** Stable cache key per proxied remote. */
export function cacheKeyForRepoUrl(repoUrl: string): string {
  return trimTrailingDotGit(repoUrl).toLowerCase();
}

/**
 * Fetches SCM metadata from the provider API (no caching).
 */
export async function fetchScmRepositoryMetadata(
  project: string,
  name: string,
  remoteUrl: string,
): Promise<SCMRepositoryMetadata | null> {
  return getGitProvider(remoteUrl).getMetadata(project, name);
}

interface CacheEntry {
  data: SCMRepositoryMetadata | null;
  storedAt: number;
  softExpiresAt: number;
}

/**
 * In-memory TTL cache with stale-while-revalidate for SCM enrichment.
 */
export class ScmMetadataCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly refreshing = new Set<string>();

  constructor(
    private readonly ttlSuccessMs: number,
    private readonly ttlFailureMs: number,
    private readonly fetchFresh: (
      project: string,
      name: string,
      url: string,
    ) => Promise<SCMRepositoryMetadata | null>,
  ) {}

  clear(): void {
    this.entries.clear();
    this.refreshing.clear();
  }

  async get(
    project: string,
    name: string,
    remoteUrl: string,
  ): Promise<SCMRepositoryMetadata | null> {
    const key = cacheKeyForRepoUrl(remoteUrl);
    const now = Date.now();
    const entry = this.entries.get(key);

    if (entry && now < entry.softExpiresAt) {
      return entry.data;
    }

    if (entry && now >= entry.softExpiresAt) {
      if (!this.refreshing.has(key)) {
        this.refreshing.add(key);
        void this.backgroundRefresh(project, name, remoteUrl, key).finally(() => {
          this.refreshing.delete(key);
        });
      }
      return entry.data;
    }

    const data = await this.fetchFresh(project, name, remoteUrl);
    const ttl = data !== null ? this.ttlSuccessMs : this.ttlFailureMs;
    this.entries.set(key, {
      data,
      storedAt: now,
      softExpiresAt: now + ttl,
    });
    return data;
  }

  private async backgroundRefresh(
    project: string,
    name: string,
    remoteUrl: string,
    key: string,
  ): Promise<void> {
    try {
      const data = await this.fetchFresh(project, name, remoteUrl);
      const now = Date.now();
      const ttl = data !== null ? this.ttlSuccessMs : this.ttlFailureMs;
      const prev = this.entries.get(key);
      if (data !== null || !prev) {
        this.entries.set(key, {
          data: data ?? prev?.data ?? null,
          storedAt: now,
          softExpiresAt: now + ttl,
        });
      } else {
        this.entries.set(key, {
          data: prev.data,
          storedAt: now,
          softExpiresAt: now + ttl,
        });
      }
    } catch {
      const prev = this.entries.get(key);
      if (prev) {
        const now = Date.now();
        this.entries.set(key, {
          ...prev,
          softExpiresAt: now + this.ttlFailureMs,
        });
      }
    }
  }
}

const defaultCache = new ScmMetadataCache(
  SUCCESS_TTL_MS,
  FAILURE_TTL_MS,
  fetchScmRepositoryMetadata,
);

export async function getCachedScmRepositoryMetadata(
  project: string,
  name: string,
  remoteUrl: string,
): Promise<SCMRepositoryMetadata | null> {
  return defaultCache.get(project, name, remoteUrl);
}

/** Test helper: reset process-wide cache between tests. */
export function clearDefaultScmMetadataCache(): void {
  defaultCache.clear();
}
