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
  private cacheDir: string;
  private maxSizeGB: number;
  private maxRepositories: number;
  private mutex: Promise<void> = Promise.resolve();

  constructor(
    cacheDir: string = './.remote/cache',
    maxSizeGB: number = 2,
    maxRepositories: number = 50,
  ) {
    this.cacheDir = cacheDir;
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
   * Update access time for repository (for LRU purposes)
   */
  async touchRepository(repoName: string): Promise<void> {
    return this.acquireLock(() => {
      const repoPath = path.join(this.cacheDir, repoName);
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
    if (!fs.existsSync(this.cacheDir)) {
      return {
        totalRepositories: 0,
        totalSizeBytes: 0,
        repositories: [],
      };
    }

    const repositories: Array<{ name: string; sizeBytes: number; lastAccessed: Date }> = [];
    let totalSizeBytes = 0;

    const entries = fs.readdirSync(this.cacheDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const repoPath = path.join(this.cacheDir, entry.name);
        const sizeBytes = this.getDirectorySize(repoPath);
        const stats = fs.statSync(repoPath);

        repositories.push({
          name: entry.name,
          sizeBytes,
          lastAccessed: stats.atime,
        });

        totalSizeBytes += sizeBytes;
      }
    }

    // Sort by last accessed (newest first)
    const sortedRepositories = repositories.toSorted(
      (a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime(),
    );

    return {
      totalRepositories: sortedRepositories.length,
      totalSizeBytes,
      repositories: sortedRepositories,
    };
  }

  /**
   * Enforce cache limits using LRU eviction
   */
  async enforceLimits(): Promise<{ removedRepos: string[]; freedBytes: number }> {
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

      return { removedRepos, freedBytes };
    });
  }

  /**
   * Remove specific repository from cache
   */
  private removeRepository(repoName: string): void {
    const repoPath = path.join(this.cacheDir, repoName);
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
            // Skip files that can't be read
          }
        }
      }
    };

    try {
      calculateSize(dirPath);
    } catch (error) {
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
      cacheDir: this.cacheDir,
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
