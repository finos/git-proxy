import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CacheManager } from '../../src/proxy/processors/push-action/cache-manager';

describe('CacheManager', () => {
  let testCacheDir;
  let cacheManager;

  beforeEach(() => {
    // Create temporary test cache directory
    testCacheDir = path.join('./.remote', 'test-cache-' + Date.now());
    if (!fs.existsSync(testCacheDir)) {
      fs.mkdirSync(testCacheDir, { recursive: true });
    }
    cacheManager = new CacheManager(testCacheDir, 0.001, 3); // 1MB, 3 repos max
  });

  afterEach(() => {
    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('getCacheStats', () => {
    it('should return empty stats for empty cache', () => {
      const stats = cacheManager.getCacheStats();
      expect(stats.totalRepositories).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
      expect(stats.repositories).toEqual([]);
    });

    it('should calculate stats for repositories in cache', () => {
      const repo1 = path.join(testCacheDir, 'repo1.git');
      const repo2 = path.join(testCacheDir, 'repo2.git');

      fs.mkdirSync(repo1);
      fs.mkdirSync(repo2);

      fs.writeFileSync(path.join(repo1, 'file1.txt'), 'a'.repeat(1024 * 1024)); // 1MB
      fs.writeFileSync(path.join(repo2, 'file2.txt'), 'b'.repeat(1024 * 1024)); // 1MB

      const stats = cacheManager.getCacheStats();
      expect(stats.totalRepositories).toBe(2);
      expect(stats.totalSizeBytes).toBeGreaterThanOrEqual(2 * 1024 * 1024); // At least 2MB total in bytes
      expect(stats.repositories).toHaveLength(2);
      expect(stats.repositories[0]).toHaveProperty('name');
      expect(stats.repositories[0]).toHaveProperty('sizeBytes');
      expect(stats.repositories[0]).toHaveProperty('lastAccessed');
    });

    it('should have timestamps for repositories', () => {
      const repo1 = path.join(testCacheDir, 'repo1.git');
      const repo2 = path.join(testCacheDir, 'repo2.git');

      fs.mkdirSync(repo1);
      fs.writeFileSync(path.join(repo1, 'file1.txt'), 'test');

      fs.mkdirSync(repo2);
      fs.writeFileSync(path.join(repo2, 'file2.txt'), 'test');

      const stats = cacheManager.getCacheStats();
      expect(stats.repositories).toHaveLength(2);
      // Each should have a valid timestamp
      stats.repositories.forEach((repo) => {
        expect(repo.lastAccessed).toBeInstanceOf(Date);
        expect(repo.lastAccessed.getTime()).toBeGreaterThan(0);
      });
    });
  });

  describe('touchRepository', () => {
    it('should update repository access time', async () => {
      const repoName = 'test-repo.git';
      const repoPath = path.join(testCacheDir, repoName);

      fs.mkdirSync(repoPath);
      fs.writeFileSync(path.join(repoPath, 'file.txt'), 'test');

      const statsBefore = cacheManager.getCacheStats();
      const timeBefore = statsBefore.repositories[0].lastAccessed.getTime();

      await new Promise((resolve) => setTimeout(resolve, 100));

      await cacheManager.touchRepository(repoName);

      const statsAfter = cacheManager.getCacheStats();
      const timeAfter = statsAfter.repositories[0].lastAccessed.getTime();

      expect(timeAfter).toBeGreaterThan(timeBefore);
    });

    it('should not throw error for non-existent repository', async () => {
      // Should not throw
      await cacheManager.touchRepository('non-existent.git');
    });
  });

  describe('enforceLimits', () => {
    it('should remove oldest repositories when exceeding count limit', async () => {
      // Create 4 repos (exceeds limit of 3)
      for (let i = 1; i <= 4; i++) {
        const repoPath = path.join(testCacheDir, `repo${i}.git`);
        fs.mkdirSync(repoPath);
        fs.writeFileSync(path.join(repoPath, 'file.txt'), 'a'.repeat(100 * 1024)); // 100KB
      }

      const statsBefore = cacheManager.getCacheStats();
      expect(statsBefore.totalRepositories).toBe(4);

      const result = await cacheManager.enforceLimits();

      expect(result.removedRepos.length).toBeGreaterThanOrEqual(1);
      expect(result.freedBytes).toBeGreaterThanOrEqual(0);

      const statsAfter = cacheManager.getCacheStats();
      expect(statsAfter.totalRepositories).toBeLessThanOrEqual(3);
    });

    it('should remove repositories when exceeding size limit', async () => {
      // Create repo that exceeds size limit (1MB)
      const repo1 = path.join(testCacheDir, 'repo1.git');
      fs.mkdirSync(repo1);
      fs.writeFileSync(path.join(repo1, 'largefile.txt'), 'a'.repeat(2 * 1024 * 1024)); // 2MB

      const statsBefore = cacheManager.getCacheStats();
      expect(statsBefore.totalSizeBytes).toBeGreaterThan(1024 * 1024); // Greater than 1MB in bytes

      const result = await cacheManager.enforceLimits();

      expect(result.removedRepos).toHaveLength(1);
      expect(result.freedBytes).toBeGreaterThan(1024 * 1024); // Greater than 1MB in bytes

      const statsAfter = cacheManager.getCacheStats();
      expect(statsAfter.totalRepositories).toBe(0);
    });

    it('should not remove anything if limits not exceeded', async () => {
      // Create 2 repos (under limit of 3)
      for (let i = 1; i <= 2; i++) {
        const repoPath = path.join(testCacheDir, `repo${i}.git`);
        fs.mkdirSync(repoPath);
        fs.writeFileSync(path.join(repoPath, 'file.txt'), 'test');
      }

      const result = await cacheManager.enforceLimits();

      expect(result.removedRepos).toHaveLength(0);
      expect(result.freedBytes).toBe(0);
    });
  });

  describe('getConfig', () => {
    it('should return cache configuration', () => {
      const config = cacheManager.getConfig();

      expect(config).toEqual({
        maxSizeGB: 0.001,
        maxRepositories: 3,
        repoCacheDir: testCacheDir,
      });
    });
  });
});
