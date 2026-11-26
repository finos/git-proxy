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

import fs from 'fs';
import path from 'path';
import { getCacheConfig } from '../../../config';

export interface CacheStats {
  totalRepositories: number;
  totalSizeBytes: number;
  repositories: Array<{
    name: string;
    sizeBytes: number;
    lastAccessed: Date;
  }>;
}

export interface CacheSettings {
  repoCacheDir: string;
  maxSizeGB: number;
  maxRepositories: number;
  gitTimeoutSeconds: number;
}

export class CacheManager {
  private overrides: Partial<CacheSettings>;
  private mutex: Promise<void> = Promise.resolve();
  private repoLocks = new Map<string, Promise<void>>();
  private activeRepos = new Map<string, number>();
  private sizes = new Map<string, number>();

  constructor(
    repoCacheDir?: string,
    maxSizeGB?: number,
    maxRepositories?: number,
    gitTimeoutSeconds?: number,
  ) {
    this.overrides = { repoCacheDir, maxSizeGB, maxRepositories, gitTimeoutSeconds };
  }

  /**
   * Acquire mutex lock for cache operations
   */
  private async acquireLock<T>(operation: () => T | Promise<T>): Promise<T> {
    const previousLock = this.mutex;
    let releaseLock: () => void;

    this.mutex = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    try {
      await previousLock;
      return await operation();
    } finally {
      releaseLock!();
    }
  }

  /**
   * Serialize all work on one cached repository.
   *
   * Pushes to the same repository run one after the other, so two of them never
   * clone, fetch or rebuild the same mirror at once. While a push holds or waits
   * for the lock, enforceLimits() will not evict that repository.
   */
  async withRepositoryLock<T>(repoName: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.repoLocks.get(repoName) ?? Promise.resolve();
    let releaseLock: () => void;
    const current = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const tail = previous.then(() => current);

    this.repoLocks.set(repoName, tail);
    this.activeRepos.set(repoName, (this.activeRepos.get(repoName) ?? 0) + 1);

    try {
      await previous;
      return await operation();
    } finally {
      releaseLock!();

      const remaining = this.activeRepos.get(repoName)! - 1;
      if (remaining === 0) {
        this.activeRepos.delete(repoName);
      } else {
        this.activeRepos.set(repoName, remaining);
      }
      if (this.repoLocks.get(repoName) === tail) {
        this.repoLocks.delete(repoName);
      }
    }
  }

  /**
   * Mark a repository as just used: bump its mtime for LRU and re-measure its size
   */
  async touchRepository(repoName: string): Promise<void> {
    const repoPath = path.join(this.getConfig().repoCacheDir, repoName);
    if (!fs.existsSync(repoPath)) {
      return;
    }

    const sizeBytes = await this.getDirectorySize(repoPath);
    return this.acquireLock(async () => {
      const now = new Date();
      await fs.promises.utimes(repoPath, now, now);
      this.sizes.set(repoName, sizeBytes);
    });
  }

  /**
   * Get cache statistics
   *
   * Sizes are measured once per repository and then only refreshed by touchRepository().
   */
  async getCacheStats(): Promise<CacheStats> {
    const { repoCacheDir } = this.getConfig();
    if (!fs.existsSync(repoCacheDir)) {
      return {
        totalRepositories: 0,
        totalSizeBytes: 0,
        repositories: [],
      };
    }

    const repositories: Array<{ name: string; sizeBytes: number; lastAccessed: Date }> = [];
    let totalSizeBytes = 0;

    const entries = await fs.promises.readdir(repoCacheDir, { withFileTypes: true });

    for (const entry of entries) {
      // Dot-prefixed folders are staging clones still being built, not cached repos
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const repoPath = path.join(repoCacheDir, entry.name);
        let sizeBytes = this.sizes.get(entry.name);
        if (sizeBytes === undefined) {
          sizeBytes = await this.getDirectorySize(repoPath);
          this.sizes.set(entry.name, sizeBytes);
        }
        const stats = await fs.promises.stat(repoPath);

        repositories.push({
          name: entry.name,
          sizeBytes,
          lastAccessed: stats.mtime,
        });

        totalSizeBytes += sizeBytes;
      }
    }

    return {
      totalRepositories: repositories.length,
      totalSizeBytes,
      repositories,
    };
  }

  /**
   * Enforce cache limits using LRU eviction
   *
   * @param protectedRepos Repositories that must survive this pass, typically the
   *   one the current push just used, even if it alone exceeds the size limit
   * @return The evicted repositories, the bytes freed and the bytes left in the cache
   */
  async enforceLimits(
    protectedRepos: string[] = [],
  ): Promise<{ removedRepos: string[]; freedBytes: number; remainingBytes: number }> {
    return this.acquireLock(async () => {
      const stats = await this.getCacheStats();
      const removedRepos: string[] = [];
      let freedBytes = 0;

      // Sort repositories by last accessed (oldest first for removal)
      const reposToEvaluate = stats.repositories.toSorted(
        (a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime(),
      );

      // Check size limit - convert GB to bytes once
      let currentSizeBytes = stats.totalSizeBytes;
      const { maxSizeGB, maxRepositories } = this.getConfig();
      const maxSizeBytes = maxSizeGB * 1024 * 1024 * 1024;

      for (const repo of reposToEvaluate) {
        if (this.activeRepos.has(repo.name) || protectedRepos.includes(repo.name)) {
          continue;
        }

        const shouldRemove =
          currentSizeBytes > maxSizeBytes || // Over size limit
          stats.totalRepositories - removedRepos.length > maxRepositories; // Over count limit

        if (shouldRemove) {
          await this.removeRepository(repo.name);
          removedRepos.push(repo.name);
          freedBytes += repo.sizeBytes;
          currentSizeBytes -= repo.sizeBytes;
        } else {
          break; // We've cleaned enough
        }
      }

      return { removedRepos, freedBytes, remainingBytes: currentSizeBytes };
    });
  }

  /**
   * Remove specific repository from cache
   */
  private async removeRepository(repoName: string): Promise<void> {
    await fs.promises.rm(path.join(this.getConfig().repoCacheDir, repoName), {
      recursive: true,
      force: true,
    });
    this.sizes.delete(repoName);
  }

  /**
   * Calculate directory size in bytes
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalBytes = 0;

    const calculateSize = async (currentPath: string) => {
      const items = await fs.promises.readdir(currentPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(currentPath, item.name);

        if (item.isDirectory()) {
          await calculateSize(itemPath);
        } else {
          try {
            const stats = await fs.promises.stat(itemPath);
            totalBytes += stats.size;
          } catch (error) {
            console.warn(`[CacheManager] Failed to stat file ${itemPath}:`, error);
          }
        }
      }
    };

    try {
      await calculateSize(dirPath);
    } catch (error) {
      console.warn(`[CacheManager] Failed to calculate size for ${dirPath}:`, error);
      return 0;
    }

    return totalBytes;
  }

  /**
   * Current cache settings. Read on every call: the shared instance is created on
   * import, before the user config file has been loaded.
   */
  getConfig(): CacheSettings {
    const config = getCacheConfig();
    return {
      repoCacheDir: this.overrides.repoCacheDir ?? config?.cacheDir ?? './.remote/cache',
      maxSizeGB: this.overrides.maxSizeGB ?? config?.maxSizeGB ?? 2,
      maxRepositories: this.overrides.maxRepositories ?? config?.maxRepositories ?? 50,
      gitTimeoutSeconds: this.overrides.gitTimeoutSeconds ?? config?.gitTimeoutSeconds ?? 600,
    };
  }
}

export const cacheManager = new CacheManager();
