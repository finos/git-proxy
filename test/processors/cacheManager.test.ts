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

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CacheManager } from '../../src/proxy/processors/push-action/cache-manager';

describe('CacheManager', () => {
  let testCacheDir: string;
  let cacheManager: CacheManager;

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

  describe('protected repositories', () => {
    it('should keep protected repositories and report the bytes left', async () => {
      const repoPath = path.join(testCacheDir, 'current.git');
      fs.mkdirSync(repoPath);
      fs.writeFileSync(path.join(repoPath, 'largefile.txt'), 'a'.repeat(2 * 1024 * 1024)); // 2MB

      const result = await cacheManager.enforceLimits(['current.git']);

      expect(result.removedRepos).toHaveLength(0);
      expect(result.remainingBytes).toBeGreaterThan(1024 * 1024);
      expect(fs.existsSync(repoPath)).toBe(true);
    });
  });

  describe('staging folders', () => {
    it('should ignore dot-prefixed staging folders in stats and eviction', async () => {
      const staging = path.join(testCacheDir, '.staging-repo1.git-123');
      fs.mkdirSync(staging);
      fs.writeFileSync(path.join(staging, 'largefile.txt'), 'a'.repeat(2 * 1024 * 1024)); // 2MB

      expect(cacheManager.getCacheStats().totalRepositories).toBe(0);

      const result = await cacheManager.enforceLimits();
      expect(result.removedRepos).toHaveLength(0);
      expect(fs.existsSync(staging)).toBe(true);
    });
  });

  describe('withRepositoryLock', () => {
    it('should run operations on the same repository one at a time', async () => {
      const events: string[] = [];
      const work = (label: string) => async () => {
        events.push(`${label}:start`);
        await new Promise((resolve) => setTimeout(resolve, 20));
        events.push(`${label}:end`);
        return label;
      };

      const results = await Promise.all([
        cacheManager.withRepositoryLock('repo.git', work('a')),
        cacheManager.withRepositoryLock('repo.git', work('b')),
      ]);

      expect(results).toEqual(['a', 'b']);
      expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
    });

    it('should not block operations on different repositories', async () => {
      const events: string[] = [];
      const work = (label: string) => async () => {
        events.push(`${label}:start`);
        await new Promise((resolve) => setTimeout(resolve, 20));
        events.push(`${label}:end`);
      };

      await Promise.all([
        cacheManager.withRepositoryLock('one.git', work('a')),
        cacheManager.withRepositoryLock('two.git', work('b')),
      ]);

      expect(events.slice(0, 2)).toEqual(['a:start', 'b:start']);
    });

    it('should release the lock when the operation throws', async () => {
      await expect(
        cacheManager.withRepositoryLock('repo.git', async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      await expect(cacheManager.withRepositoryLock('repo.git', async () => 'next')).resolves.toBe(
        'next',
      );
    });

    it('should not evict a repository while it is locked', async () => {
      const repoPath = path.join(testCacheDir, 'busy.git');
      fs.mkdirSync(repoPath);
      fs.writeFileSync(path.join(repoPath, 'largefile.txt'), 'a'.repeat(2 * 1024 * 1024)); // 2MB

      await cacheManager.withRepositoryLock('busy.git', async () => {
        const result = await cacheManager.enforceLimits();
        expect(result.removedRepos).toHaveLength(0);
        expect(fs.existsSync(repoPath)).toBe(true);
      });

      // Once released it is fair game again
      const result = await cacheManager.enforceLimits();
      expect(result.removedRepos).toEqual(['busy.git']);
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
