const path = require('path');
const simpleGit = require('simple-git');
const fs = require('fs').promises;
const { Action } = require('../../src/proxy/actions');
const { exec } = require('../../src/proxy/processors/push-action/getDiff');

const chai = require('chai');
const expect = chai.expect;

describe('getDiff', () => {
  let tempDir;
  let git;
  
  before(async () => {
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
  
  after(async () => {
    await fs.rmdir(tempDir, { recursive: true });
  });
  
  it('should get diff between commits', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'modified content');
    await git.add('.');
    await git.commit('second commit');
    
    const action = new Action(
      '1234567890',
      'push',
      'POST',
      1234567890,
      'test/repo'
    );
    action.proxyGitPath = __dirname; // Temp dir parent path
    action.repoName = 'temp-test-repo';
    action.commitFrom = 'HEAD~1';
    action.commitTo = 'HEAD';
    action.commitData = [
      { parent: '0000000000000000000000000000000000000000' }
    ];
    
    const result = await exec({}, action);
    
    expect(result.steps[0].error).to.be.false;
    expect(result.steps[0].content).to.include('modified content');
    expect(result.steps[0].content).to.include('initial content');
  });

  it('should get diff between commits with no changes', async () => {
    const action = new Action(
      '1234567890',
      'push',
      'POST',
      1234567890,
      'test/repo'
    );
    action.proxyGitPath = __dirname; // Temp dir parent path
    action.repoName = 'temp-test-repo';
    action.commitFrom = 'HEAD~1';
    action.commitTo = 'HEAD';
    action.commitData = [
      { parent: '0000000000000000000000000000000000000000' }
    ];

    const result = await exec({}, action);

    expect(result.steps[0].error).to.be.false;
    expect(result.steps[0].content).to.include('initial content');
  });

  it('should throw an error if no commit data is provided', async () => {
    const action = new Action(
      '1234567890',
      'push',
      'POST',
      1234567890,
      'test/repo'
    );
    action.proxyGitPath = __dirname; // Temp dir parent path
    action.repoName = 'temp-test-repo';
    action.commitFrom = 'HEAD~1';
    action.commitTo = 'HEAD';
    action.commitData = [];

    const result = await exec({}, action);
    expect(result.steps[0].error).to.be.true;
    expect(result.steps[0].errorMessage).to.contain('No commit data found');
  });

  it('should throw an error if no commit data is provided', async () => {
    const action = new Action(
      '1234567890',
      'push',
      'POST',
      1234567890,
      'test/repo'
    );
    action.proxyGitPath = __dirname; // Temp dir parent path
    action.repoName = 'temp-test-repo';
    action.commitFrom = 'HEAD~1';
    action.commitTo = 'HEAD';
    action.commitData = undefined;

    const result = await exec({}, action);
    expect(result.steps[0].error).to.be.true;
    expect(result.steps[0].errorMessage).to.contain('No commit data found');
  });

  it('should handle empty commit hash in commitFrom', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'new content for parent test');
    await git.add('.');
    await git.commit('commit for parent test');

    const log = await git.log();
    const parentCommit = log.all[1].hash;
    const headCommit = log.all[0].hash;

    const action = new Action(
      '1234567890',
      'push',
      'POST',
      1234567890,
      'test/repo'
    );

    action.proxyGitPath = path.dirname(tempDir);
    action.repoName = path.basename(tempDir);
    action.commitFrom = '0000000000000000000000000000000000000000';
    action.commitTo = headCommit;
    action.commitData = [
      { parent: parentCommit }
    ];

    const result = await exec({}, action);

    expect(result.steps[0].error).to.be.false;
    expect(result.steps[0].content).to.not.be.null;
    expect(result.steps[0].content.length).to.be.greaterThan(0);
  });
});
