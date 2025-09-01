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
    it('should handle legitimate empty diff after rebase scenario', async function () {
      this.timeout(5000); // eslint-disable-line no-invalid-this

      // Create action simulating force push with old unreachable SHA
      const action = new Action(
        'force-push-integration',
        'push',
        'POST',
        Date.now(),
        'test/repo.git',
      );
      action.proxyGitPath = path.dirname(tempDir);
      action.repoName = path.basename(tempDir);
      action.commitFrom = initialCommitSHA; // Old SHA
      action.commitTo = rebasedCommitSHA; // New SHA after rebase
      action.commitData = [
        {
          parent: initialCommitSHA,
          commit: rebasedCommitSHA,
          message: 'Add feature (rebased)',
          author: 'Test User',
        },
      ];

      const afterGetDiff = await getDiff({}, action);
      expect(afterGetDiff.steps).to.have.length.greaterThan(0);

      const diffStep = afterGetDiff.steps.find((s) => s.stepName === 'diff');
      expect(diffStep).to.exist;

      // May produce empty diff or error - both should be handled
      if (diffStep.error) {
        console.log('getDiff failed as expected with unreachable commitFrom');
        expect(diffStep.errorMessage).to.be.a('string');
      } else {
        console.log('getDiff succeeded, checking content');
        expect(diffStep.content).to.satisfy(
          (content) => content === null || content === undefined || typeof content === 'string',
        );
      }

      // scanDiff should not block on empty/missing diff
      const afterScanDiff = await scanDiff({}, afterGetDiff);
      const scanStep = afterScanDiff.steps.find((s) => s.stepName === 'scanDiff');

      expect(scanStep).to.exist;

      // scanDiff should NOT error on empty diff
      if (diffStep.error || !diffStep.content) {
        expect(scanStep.error).to.be.false;
        console.log('scanDiff correctly allowed empty/missing diff');
      } else {
        // If diff exists, should process normally
        expect(scanStep.error).to.be.false;
        console.log('scanDiff processed valid diff content');
      }
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
