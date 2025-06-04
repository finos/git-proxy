const path = require('path');
const simpleGit = require('simple-git');
const fs = require('fs');
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
    await fs.mkdir(tempDir, { recursive: true }, (err) => {
      if (err) {
        console.error(err);
      }
    });
    git = simpleGit(tempDir);
    
    await git.init();
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'initial content', (err) => {
      if (err) {
        console.error(err);
      }
    });
    await git.add('.');
    await git.commit('initial commit');
  });
  
  after(async () => {
    await fs.rmdir(tempDir, { recursive: true }, (err) => {
      if (err) {
        console.error(err);
      }
    });
  });
  
  it('should get diff between commits', async () => {
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'modified content', (err) => {
      if (err) {
        console.error(err);
      }
    });
    await git.add('.');
    const commit = await git.commit('second commit');
    
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
  });
});
