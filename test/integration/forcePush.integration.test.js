const path = require('path');
const simpleGit = require('simple-git');
const fs = require('fs').promises;
const { Action } = require('../../src/proxy/actions');
const { exec: getDiff } = require('../../src/proxy/processors/push-action/getDiff');
const { exec: scanDiff } = require('../../src/proxy/processors/push-action/scanDiff');

const chai = require('chai');
const expect = chai.expect;

describe('Force Push Integration Test', () => {
  let tempDir;
  let git;
  let initialCommitSHA;
  let rebasedCommitSHA;

  before(async function () {
    this.timeout(10000); // eslint-disable-line no-invalid-this

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
    initialCommitSHA = log.latest.hash;

    // Simulate rebase by amending commit (changes SHA)
    await git.commit(['--amend', '-m', 'Add feature (rebased)']);

    const newLog = await git.log();
    rebasedCommitSHA = newLog.latest.hash;

    console.log(`Initial SHA: ${initialCommitSHA}`);
    console.log(`Rebased SHA: ${rebasedCommitSHA}`);
  });

  after(async () => {
    try {
      await fs.rmdir(tempDir, { recursive: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Complete force push pipeline', () => {
    it('should handle valid diff after rebase scenario', async function () {
      this.timeout(5000); // eslint-disable-line no-invalid-this

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
          commit: rebasedCommitSHA,
          message: 'Add feature (rebased)',
          author: 'Test User',
        },
      ];

      const afterGetDiff = await getDiff({}, action);
      expect(afterGetDiff.steps).to.have.length.greaterThan(0);

      const diffStep = afterGetDiff.steps.find((s) => s.stepName === 'diff');
      expect(diffStep).to.exist;
      expect(diffStep.error).to.be.false;
      expect(diffStep.content).to.be.a('string');
      expect(diffStep.content.length).to.be.greaterThan(0);

      const afterScanDiff = await scanDiff({}, afterGetDiff);
      const scanStep = afterScanDiff.steps.find((s) => s.stepName === 'scanDiff');

      expect(scanStep).to.exist;
      expect(scanStep.error).to.be.false;
    });

    it('should handle unreachable commit SHA error', async function () {
      this.timeout(5000); // eslint-disable-line no-invalid-this

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
      action.commitFrom = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'; // Invalid SHA
      action.commitTo = rebasedCommitSHA;
      action.commitData = [
        {
          parent: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
          commit: rebasedCommitSHA,
          message: 'Add feature (rebased)',
          author: 'Test User',
        },
      ];

      const afterGetDiff = await getDiff({}, action);
      expect(afterGetDiff.steps).to.have.length.greaterThan(0);

      const diffStep = afterGetDiff.steps.find((s) => s.stepName === 'diff');
      expect(diffStep).to.exist;
      expect(diffStep.error).to.be.true;
      expect(diffStep.errorMessage).to.be.a('string');
      expect(diffStep.errorMessage.length).to.be.greaterThan(0);
      expect(diffStep.errorMessage).to.satisfy(
        (msg) =>
          msg.includes('fatal:') ||
          msg.includes('unknown revision') ||
          msg.includes('bad revision'),
        'Error message should contain git-specific error patterns',
      );

      // scanDiff should not block on missing diff due to error
      const afterScanDiff = await scanDiff({}, afterGetDiff);
      const scanStep = afterScanDiff.steps.find((s) => s.stepName === 'scanDiff');

      expect(scanStep).to.exist;
      expect(scanStep.error).to.be.false;
    });

    it('should handle missing diff step gracefully', async function () {
      const action = new Action(
        'missing-diff-integration',
        'push',
        'POST',
        Date.now(),
        'test/repo.git',
      );

      const result = await scanDiff({}, action);

      expect(result.steps).to.have.length(1);
      expect(result.steps[0].stepName).to.equal('scanDiff');
      expect(result.steps[0].error).to.be.false;
    });
  });
});
