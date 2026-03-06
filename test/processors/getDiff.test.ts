import path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs/promises';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { Action } from '../../src/proxy/actions';
import { exec } from '../../src/proxy/processors/push-action/getDiff';
import { CommitData } from '../../src/proxy/processors/types';
import { EMPTY_COMMIT_HASH } from '../../src/proxy/processors/constants';

describe('getDiff', () => {
  let tempDir: string;
  let git: SimpleGit;

  beforeAll(async () => {
    // Create a temp repo to avoid mocking simple-git
    tempDir = path.join(__dirname, 'temp-test-repo');
    await fs.mkdir(tempDir, { recursive: true });
    git = simpleGit(tempDir);

    await git.init();
    await git.addConfig('user.name', 'test');
    await git.addConfig('user.email', 'test@test.com');

    await fs.writeFile(path.join(tempDir, 'test.txt'), 'initial content');
    await git.add('.');
    await git.commit('initial commit');
  });

  afterAll(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should get diff between commits', async () => {
    // Ensure we have a known state: write initial content, then modify it
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'initial content');
    await git.add('.');
    // Use --allow-empty or amend to handle case where content is already 'initial content'
    try {
      await git.commit('reset to initial');
    } catch {
      // no changes to commit - that's fine
    }

    await fs.writeFile(path.join(tempDir, 'test.txt'), 'modified content');
    await git.add('.');
    await git.commit('second commit');

    const action = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo.git');
    action.proxyGitPath = __dirname; // Temp dir parent path
    action.repoName = 'temp-test-repo';
    action.commitFrom = 'HEAD~1';
    action.commitTo = 'HEAD';
    action.commitData = [{ parent: EMPTY_COMMIT_HASH } as CommitData];

    const result = await exec({}, action);

    expect(result.steps[0].error).toBe(false);
    expect(result.steps[0].content).toContain('modified content');
    expect(result.steps[0].content).toContain('initial content');
  });

  it('should get diff between commits with no changes', async () => {
    // Create a known two-commit state: initial -> same content commit
    await fs.writeFile(path.join(tempDir, 'test-nochange.txt'), 'initial content');
    await git.add('.');
    await git.commit('base commit for no-change test');

    await fs.writeFile(path.join(tempDir, 'test-nochange2.txt'), 'more initial content');
    await git.add('.');
    await git.commit('second commit for no-change test');

    const action = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo.git');
    action.proxyGitPath = __dirname; // Temp dir parent path
    action.repoName = 'temp-test-repo';
    action.commitFrom = 'HEAD~1';
    action.commitTo = 'HEAD';
    action.commitData = [{ parent: EMPTY_COMMIT_HASH } as CommitData];

    const result = await exec({}, action);

    expect(result.steps[0].error).toBe(false);
    expect(result.steps[0].content).toContain('initial content');
  });

  it('should throw an error if no commit data is provided', async () => {
    const action = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo.git');
    action.proxyGitPath = __dirname; // Temp dir parent path
    action.repoName = 'temp-test-repo';
    action.commitFrom = 'HEAD~1';
    action.commitTo = 'HEAD';
    action.commitData = [];

    const result = await exec({}, action);
    expect(result.steps[0].error).toBe(true);
    expect(result.steps[0].errorMessage).toContain(
      'Your push has been blocked because no commit data was found',
    );
  });

  it('should throw an error if commit data is undefined', async () => {
    const action = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo.git');
    action.proxyGitPath = __dirname; // Temp dir parent path
    action.repoName = 'temp-test-repo';
    action.commitFrom = 'HEAD~1';
    action.commitTo = 'HEAD';
    action.commitData = undefined as any;

    const result = await exec({}, action);
    expect(result.steps[0].error).toBe(true);
    expect(result.steps[0].errorMessage).toContain(
      'Your push has been blocked because no commit data was found',
    );
  });

  it('should handle empty commit hash in commitFrom', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'new content for parent test');
    await git.add('.');
    await git.commit('commit for parent test');

    const log = await git.log();
    const parentCommit = log.all[1].hash;
    const headCommit = log.all[0].hash;

    const action = new Action('1234567890', 'push', 'POST', 1234567890, 'test/repo.git');

    action.proxyGitPath = path.dirname(tempDir);
    action.repoName = path.basename(tempDir);
    action.commitFrom = EMPTY_COMMIT_HASH;
    action.commitTo = headCommit;
    action.commitData = [{ parent: parentCommit } as CommitData];

    const result = await exec({}, action);

    expect(result.steps[0].error).toBe(false);
    expect(result.steps[0].content).not.toBeNull();
    expect(result.steps[0].content!.length).toBeGreaterThan(0);
  });
  describe('fuzzing', () => {
    it('should handle random action inputs without crashing', async function () {
      // Not comprehensive but helps prevent crashing on bad input
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 0, maxLength: 40 }),
          fc.string({ minLength: 0, maxLength: 40 }),
          fc.array(fc.record({ parent: fc.string({ minLength: 0, maxLength: 40 }) }), {
            maxLength: 3,
          }),
          async (from, to, commitData) => {
            const action = new Action('id', 'push', 'POST', Date.now(), 'test/repo');
            action.proxyGitPath = __dirname;
            action.repoName = 'temp-test-repo';
            action.commitFrom = from;
            action.commitTo = to;
            action.commitData = commitData as any;

            const result = await exec({}, action);

            expect(result).toHaveProperty('steps');
            expect(result.steps[0]).toHaveProperty('error');
            expect(result.steps[0]).toHaveProperty('content');
          },
        ),
        { numRuns: 10 },
      );
    });

    it('should handle randomized commitFrom and commitTo of proper length', async function () {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[0-9a-fA-F]{40}$/),
          fc.stringMatching(/^[0-9a-fA-F]{40}$/),
          async (from, to) => {
            const action = new Action('id', 'push', 'POST', Date.now(), 'test/repo');
            action.proxyGitPath = __dirname;
            action.repoName = 'temp-test-repo';
            action.commitFrom = from;
            action.commitTo = to;
            action.commitData = [{ parent: EMPTY_COMMIT_HASH } as CommitData];

            const result = await exec({}, action);

            expect(result.steps[0].error).toBe(true);
            expect(result.steps[0].errorMessage).toContain('Invalid revision range');
          },
        ),
        { numRuns: 10 },
      );
    });
  });
});
