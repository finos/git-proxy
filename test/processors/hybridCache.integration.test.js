import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import { exec as pullRemote } from '../../src/proxy/processors/push-action/pullRemote';
import { exec as clearBareClone } from '../../src/proxy/processors/push-action/clearBareClone';
import { Action } from '../../src/proxy/actions/Action';
import { cacheManager } from '../../src/proxy/processors/push-action/cache-manager';

describe('Hybrid Cache Integration Tests', () => {
  const testRepoUrl = 'https://github.com/finos/git-proxy.git';
  const testRepoName = 'finos/git-proxy.git';
  const authorization = `Basic ${Buffer.from('test:test').toString('base64')}`;

  // Shared test data populated by before() hook
  let testData = {
    cacheMissAction: null,
    cacheHitAction: null,
    cacheMissDuration: 0,
    cacheHitDuration: 0,
    bareRepoPath: './.remote/cache/git-proxy.git',
    inodeBefore: null,
    inodeAfter: null,
  };

  beforeAll(async () => {
    console.log('\n  === Setting up test data (one-time setup) ===');

    // Clean up before starting
    if (fs.existsSync('./.remote')) {
      fs.rmSync('./.remote', { recursive: true, force: true });
    }

    const cacheMissActionId = 'cache-miss-' + Date.now();
    const cacheHitActionId = 'cache-hit-' + Date.now();

    // First clone - cache MISS
    console.log('Executing cache MISS...');
    const cacheMissAction = new Action(cacheMissActionId, 'push', 'POST', Date.now(), testRepoName);
    cacheMissAction.url = testRepoUrl;

    const cacheMissStart = Date.now();
    await pullRemote({ headers: { authorization } }, cacheMissAction);
    testData.cacheMissDuration = Date.now() - cacheMissStart;
    testData.cacheMissAction = cacheMissAction;

    console.log(`Cache MISS completed in ${testData.cacheMissDuration}ms`);

    // Get inode before second clone
    const bareRepoStatsBefore = fs.statSync(testData.bareRepoPath);
    testData.inodeBefore = bareRepoStatsBefore.ino;

    // Wait a bit to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Second clone - cache HIT
    console.log('Executing cache HIT...');
    const cacheHitAction = new Action(cacheHitActionId, 'push', 'POST', Date.now(), testRepoName);
    cacheHitAction.url = testRepoUrl;

    const cacheHitStart = Date.now();
    await pullRemote({ headers: { authorization } }, cacheHitAction);
    testData.cacheHitDuration = Date.now() - cacheHitStart;
    testData.cacheHitAction = cacheHitAction;

    console.log(`Cache HIT completed in ${testData.cacheHitDuration}ms`);

    // Get inode after second clone
    const bareRepoStatsAfter = fs.statSync(testData.bareRepoPath);
    testData.inodeAfter = bareRepoStatsAfter.ino;
  }, 120000);

  afterAll(() => {
    // Clean up all .remote directories after all tests
    if (fs.existsSync('./.remote')) {
      fs.rmSync('./.remote', { recursive: true, force: true });
    }
  });

  describe('Cache MISS (first clone)', () => {
    it('should create bare cache repository', () => {
      // Verify bare cache was created
      expect(fs.existsSync(testData.bareRepoPath)).toBe(true);

      // Verify it's a bare repository (has config, refs, objects)
      expect(fs.existsSync(`${testData.bareRepoPath}/config`)).toBe(true);
      expect(fs.existsSync(`${testData.bareRepoPath}/refs`)).toBe(true);
      expect(fs.existsSync(`${testData.bareRepoPath}/objects`)).toBe(true);
    });

    it('should create working copy with actual files', () => {
      const actionId = testData.cacheMissAction.id;

      // Verify working copy was created
      expect(fs.existsSync(`./.remote/work/${actionId}`)).toBe(true);

      // Check the content inside working copy directory
      const workCopyContents = fs.readdirSync(`./.remote/work/${actionId}`);
      expect(workCopyContents.length).toBeGreaterThan(0);

      // Verify we have a git repository directory inside
      const repoDir = workCopyContents.find((item) => item.includes('git-proxy'));
      expect(repoDir).toBeDefined();

      // Verify it has .git folder (not bare)
      expect(fs.existsSync(`./.remote/work/${actionId}/${repoDir}/.git`)).toBe(true);

      // Verify working copy has actual files
      expect(fs.existsSync(`./.remote/work/${actionId}/${repoDir}/package.json`)).toBe(true);
    });
  });

  describe('Cache HIT (second clone)', () => {
    it('should reuse existing bare cache (not recreate)', () => {
      // Verify bare cache still exists
      expect(fs.existsSync(testData.bareRepoPath)).toBe(true);

      // Same inode means same directory (not recreated)
      expect(testData.inodeAfter).toBe(testData.inodeBefore);
    });

    it('should create new isolated working copy', () => {
      const cacheMissActionId = testData.cacheMissAction.id;
      const cacheHitActionId = testData.cacheHitAction.id;

      // Verify new working copy was created
      expect(fs.existsSync(`./.remote/work/${cacheHitActionId}`)).toBe(true);

      // Verify both working copies exist (isolated)
      expect(fs.existsSync(`./.remote/work/${cacheMissActionId}`)).toBe(true);
      expect(fs.existsSync(`./.remote/work/${cacheHitActionId}`)).toBe(true);

      // Verify they are different directories
      expect(cacheMissActionId).not.toBe(cacheHitActionId);
    });

    it('should be faster than cache MISS', () => {
      console.log(`      Cache MISS: ${testData.cacheMissDuration}ms`);
      console.log(`      Cache HIT: ${testData.cacheHitDuration}ms`);
      console.log(
        `      Performance improvement: ${Math.round((1 - testData.cacheHitDuration / testData.cacheMissDuration) * 100)}%`,
      );

      expect(testData.cacheHitDuration).toBeLessThan(testData.cacheMissDuration);
    });
  });

  describe('Hybrid cache structure', () => {
    it('should maintain separate bare cache and working directories', () => {
      // Verify directory structure
      expect(fs.existsSync('./.remote/cache')).toBe(true);
      expect(fs.existsSync('./.remote/work')).toBe(true);

      // Verify bare cache contains .git repositories
      const cacheContents = fs.readdirSync('./.remote/cache');
      expect(cacheContents.some((name) => name.endsWith('.git'))).toBe(true);

      // Verify work directory contains action-specific folders
      const workContents = fs.readdirSync('./.remote/work');
      expect(workContents.length).toBeGreaterThanOrEqual(2); // At least 2 working copies
    });

    it('should share one bare cache for multiple working copies', () => {
      const cacheContents = fs.readdirSync('./.remote/cache');
      const gitProxyRepos = cacheContents.filter((name) => name.includes('git-proxy'));

      // Should be only one bare cache for git-proxy
      expect(gitProxyRepos.length).toBe(1);
    });
  });

  describe('Cache manager integration', () => {
    it('should track cache statistics', () => {
      const stats = cacheManager.getCacheStats();

      expect(stats.totalRepositories).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(stats.repositories)).toBe(true);
      expect(stats.repositories.length).toBeGreaterThanOrEqual(1);

      const gitProxyRepo = stats.repositories.find((r) => r.name === 'git-proxy.git');
      expect(gitProxyRepo).toBeDefined();
      expect(gitProxyRepo.sizeBytes).toBeGreaterThan(0);
      expect(gitProxyRepo.lastAccessed).toBeInstanceOf(Date);
    });
  });

  describe('Cache cleanup', () => {
    it('should remove working copy and enforce cache limits', async () => {
      expect(fs.existsSync('./.remote')).toBe(true);

      const actionId = testData.cacheMissAction.id;
      await clearBareClone(null, testData.cacheMissAction);

      expect(fs.existsSync(`./.remote/work/${actionId}`)).toBe(false);
      expect(fs.existsSync('./.remote/cache')).toBe(true);
    });
  });
});
