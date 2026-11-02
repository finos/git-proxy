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

export class CacheManager {
  private repoCacheDir: string;
  private maxSizeGB: number;
  private maxRepositories: number;
  private mutex: Promise<void> = Promise.resolve();
  private repoLocks = new Map<string, Promise<void>>();
  private activeRepos = new Map<string, number>();

  constructor(
    repoCacheDir: string = './.remote/cache',
    maxSizeGB: number = 2,
    maxRepositories: number = 50,
  ) {
    this.repoCacheDir = repoCacheDir;
    this.maxSizeGB = maxSizeGB;
    this.maxRepositories = maxRepositories;
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
   * Update access time for repository (for LRU purposes)
   */
  async touchRepository(repoName: string): Promise<void> {
    return this.acquireLock(() => {
      const repoPath = path.join(this.repoCacheDir, repoName);
      if (fs.existsSync(repoPath)) {
        const now = new Date();
        fs.utimesSync(repoPath, now, now);
      }
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    if (!fs.existsSync(this.repoCacheDir)) {
      return {
        totalRepositories: 0,
        totalSizeBytes: 0,
        repositories: [],
      };
    }

    const repositories: Array<{ name: string; sizeBytes: number; lastAccessed: Date }> = [];
    let totalSizeBytes = 0;

    const entries = fs.readdirSync(this.repoCacheDir, { withFileTypes: true });

    for (const entry of entries) {
      // Dot-prefixed folders are staging clones still being built, not cached repos
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const repoPath = path.join(this.repoCacheDir, entry.name);
        const sizeBytes = this.getDirectorySize(repoPath);
        const stats = fs.statSync(repoPath);

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
    return this.acquireLock(() => {
      const stats = this.getCacheStats();
      const removedRepos: string[] = [];
      let freedBytes = 0;

      // Sort repositories by last accessed (oldest first for removal)
      const reposToEvaluate = stats.repositories.toSorted(
        (a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime(),
      );

      // Check size limit - convert GB to bytes once
      let currentSizeBytes = stats.totalSizeBytes;
      const maxSizeBytes = this.maxSizeGB * 1024 * 1024 * 1024;

      for (const repo of reposToEvaluate) {
        if (this.activeRepos.has(repo.name) || protectedRepos.includes(repo.name)) {
          continue;
        }

        const shouldRemove =
          currentSizeBytes > maxSizeBytes || // Over size limit
          stats.totalRepositories - removedRepos.length > this.maxRepositories; // Over count limit

        if (shouldRemove) {
          this.removeRepository(repo.name);
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
  private removeRepository(repoName: string): void {
    const repoPath = path.join(this.repoCacheDir, repoName);
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
  }

  /**
   * Calculate directory size in bytes
   */
  private getDirectorySize(dirPath: string): number {
    let totalBytes = 0;

    const calculateSize = (currentPath: string) => {
      const items = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(currentPath, item.name);

        if (item.isDirectory()) {
          calculateSize(itemPath);
        } else {
          try {
            const stats = fs.statSync(itemPath);
            totalBytes += stats.size;
          } catch (error) {
            console.warn(`[CacheManager] Failed to stat file ${itemPath}:`, error);
          }
        }
      }
    };

    try {
      calculateSize(dirPath);
    } catch (error) {
      console.warn(`[CacheManager] Failed to calculate size for ${dirPath}:`, error);
      return 0;
    }

    return totalBytes;
  }

  /**
   * Get cache configuration
   */
  getConfig() {
    return {
      maxSizeGB: this.maxSizeGB,
      maxRepositories: this.maxRepositories,
      repoCacheDir: this.repoCacheDir,
    };
  }
}

// Global instance initialized with config
const config = getCacheConfig();
export const cacheManager = new CacheManager(
  config?.cacheDir,
  config?.maxSizeGB,
  config?.maxRepositories,
);
