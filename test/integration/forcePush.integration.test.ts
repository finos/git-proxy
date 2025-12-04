import path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';

import { Action } from '../../src/proxy/actions';
import { exec as getDiff } from '../../src/proxy/processors/push-action/getDiff';
import { exec as scanDiff } from '../../src/proxy/processors/push-action/scanDiff';

describe(
  'Force Push Integration Test',
  () => {
    let tempDir: string;
    let git: SimpleGit;
    let initialCommitSHA: string;
    let rebasedCommitSHA: string;

    beforeAll(async () => {
      tempDir = path.join(__dirname, '../temp-integration-repo');
      await fs.mkdir(tempDir, { recursive: true });
      git = simpleGit(tempDir);

      await git.init();
      await git.addConfig('user.name', 'Test User');
      await git.addConfig('user.email', 'test@example.com');

      // Create initial commit
      await fs.writeFile(path.join(tempDir, 'base.txt'), 'base content');
      await git.add('.');
      await git.commit('Initial commit');

      // Create feature commit
      await fs.writeFile(path.join(tempDir, 'feature.txt'), 'feature content');
      await git.add('.');
      await git.commit('Add feature');

      const log = await git.log();
      initialCommitSHA = log.latest?.hash ?? '';

      // Simulate rebase by amending commit (changes SHA)
      await git.commit(['--amend', '-m', 'Add feature (rebased)']);

      const newLog = await git.log();
      rebasedCommitSHA = newLog.latest?.hash ?? '';

      console.log(`Initial SHA: ${initialCommitSHA}`);
      console.log(`Rebased SHA: ${rebasedCommitSHA}`);
    }, 10000);

    afterAll(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('Complete force push pipeline', () => {
      it('should handle valid diff after rebase scenario', async () => {
        // Create action simulating force push with valid SHAs that have actual changes
        const action = new Action(
          'valid-diff-integration',
          'push',
          'POST',
          Date.now(),
          'test/repo.git',
        );
        action.proxyGitPath = path.dirname(tempDir);
        action.repoName = path.basename(tempDir);

        // Parent of initial commit to get actual diff content
        const parentSHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
        action.commitFrom = parentSHA;
        action.commitTo = rebasedCommitSHA;
        action.commitData = [
          {
            parent: parentSHA,
            message: 'Add feature (rebased)',
            author: 'Test User',
            committer: 'Test User',
            committerEmail: 'test@example.com',
            tree: 'tree SHA',
            authorEmail: 'test@example.com',
          },
        ];

        const afterGetDiff = await getDiff({}, action);
        expect(afterGetDiff.steps.length).toBeGreaterThan(0);

        const diffStep = afterGetDiff.steps.find((s: any) => s.stepName === 'diff');
        if (!diffStep) {
          throw new Error('Diff step not found');
        }

        expect(diffStep.error).toBe(false);
        expect(typeof diffStep.content).toBe('string');
        expect(diffStep.content.length).toBeGreaterThan(0);

        const afterScanDiff = await scanDiff({}, afterGetDiff);
        const scanStep = afterScanDiff.steps.find((s: any) => s.stepName === 'scanDiff');

        expect(scanStep).toBeDefined();
        expect(scanStep?.error).toBe(false);
      });

      it('should handle unreachable commit SHA error', async () => {
        // Invalid SHA to trigger error
        const action = new Action(
          'unreachable-sha-integration',
          'push',
          'POST',
          Date.now(),
          'test/repo.git',
        );
        action.proxyGitPath = path.dirname(tempDir);
        action.repoName = path.basename(tempDir);
        action.commitFrom = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
        action.commitTo = rebasedCommitSHA;
        action.commitData = [
          {
            parent: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
            message: 'Add feature (rebased)',
            author: 'Test User',
            committer: 'Test User',
            committerEmail: 'test@example.com',
            tree: 'tree SHA',
            authorEmail: 'test@example.com',
          },
        ];

        const afterGetDiff = await getDiff({}, action);
        expect(afterGetDiff.steps.length).toBeGreaterThan(0);

        const diffStep = afterGetDiff.steps.find((s: any) => s.stepName === 'diff');
        if (!diffStep) {
          throw new Error('Diff step not found');
        }

        expect(diffStep.error).toBe(true);
        expect(typeof diffStep.errorMessage).toBe('string');
        expect(diffStep.errorMessage?.length).toBeGreaterThan(0);
        expect(diffStep.errorMessage).toSatisfy(
          (msg: string) => msg.includes('fatal:') && msg.includes('Invalid revision range'),
        );

        // scanDiff should not block on missing diff due to error
        const afterScanDiff = await scanDiff({}, afterGetDiff);
        const scanStep = afterScanDiff.steps.find((s: any) => s.stepName === 'scanDiff');

        expect(scanStep).toBeDefined();
        expect(scanStep?.error).toBe(false);
      });

      it('should handle missing diff step gracefully', async () => {
        const action = new Action(
          'missing-diff-integration',
          'push',
          'POST',
          Date.now(),
          'test/repo.git',
        );

        const result = await scanDiff({}, action);

        expect(result.steps.length).toBe(1);
        expect(result.steps[0].stepName).toBe('scanDiff');
        expect(result.steps[0].error).toBe(false);
      });
    });
  },
  { timeout: 20000 },
);
