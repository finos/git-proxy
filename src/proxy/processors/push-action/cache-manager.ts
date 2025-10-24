import fs from 'fs';
import path from 'path';
import { getCacheConfig } from '../../../config';

export interface CacheStats {
  totalRepositories: number;
  totalSizeMB: number;
  repositories: Array<{
    name: string;
    sizeMB: number;
    lastAccessed: Date;
  }>;
}

export class CacheManager {
  private cacheDir: string;
  private maxSizeGB: number;
  private maxRepositories: number;

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
   * Update access time for repository (for LRU purposes)
   */
  touchRepository(repoName: string): void {
    const repoPath = path.join(this.cacheDir, repoName);
    if (fs.existsSync(repoPath)) {
      const now = new Date();
      fs.utimesSync(repoPath, now, now);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    if (!fs.existsSync(this.cacheDir)) {
      return {
        totalRepositories: 0,
        totalSizeMB: 0,
        repositories: [],
      };
    }

    const repositories: Array<{ name: string; sizeMB: number; lastAccessed: Date }> = [];
    let totalSizeMB = 0;

    const entries = fs.readdirSync(this.cacheDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const repoPath = path.join(this.cacheDir, entry.name);
        const sizeMB = this.getDirectorySize(repoPath);
        const stats = fs.statSync(repoPath);

        repositories.push({
          name: entry.name,
          sizeMB,
          lastAccessed: stats.atime,
        });

        totalSizeMB += sizeMB;
      }
    }

    // Sort by last accessed (newest first)
    repositories.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());

    return {
      totalRepositories: repositories.length,
      totalSizeMB,
      repositories,
    };
  }

  /**
   * Enforce cache limits using LRU eviction
   */
  enforceLimits(): { removedRepos: string[]; freedMB: number } {
    const stats = this.getCacheStats();
    const removedRepos: string[] = [];
    let freedMB = 0;

    // Sort repositories by last accessed (oldest first for removal)
    const reposToEvaluate = [...stats.repositories].sort(
      (a, b) => a.lastAccessed.getTime() - b.lastAccessed.getTime(),
    );

    // Check size limit
    let currentSizeMB = stats.totalSizeMB;
    const maxSizeMB = this.maxSizeGB * 1024;

    for (const repo of reposToEvaluate) {
      const shouldRemove =
        currentSizeMB > maxSizeMB || // Over size limit
        stats.totalRepositories - removedRepos.length > this.maxRepositories; // Over count limit

      if (shouldRemove) {
        this.removeRepository(repo.name);
        removedRepos.push(repo.name);
        freedMB += repo.sizeMB;
        currentSizeMB -= repo.sizeMB;
      } else {
        break; // We've cleaned enough
      }
    }

    return { removedRepos, freedMB };
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
   * Calculate directory size in MB
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

    return Math.round(totalBytes / (1024 * 1024)); // Convert to MB
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
  config.cacheDir,
  config.maxSizeGB,
  config.maxRepositories,
);
