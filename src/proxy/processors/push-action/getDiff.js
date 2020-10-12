const child = require('child_process');
const Step = require('../../actions').Step;

const exec = async (req, action) => {
  const step = new Step('diff');

  try {
    console.log(action.commitFrom)
    
    const path = `${action.proxyGitPath}/${action.repoName}`;
    
    // If this is a new repo or fresh branch
    // see https://stackoverflow.com/questions/40883798/how-to-get-git-diff-of-the-first-commit
    let cmd = `git diff 4b825dc642cb6eb9a060e54bf8d69288fbee4904 ${action.commitTo}`

    if (action.commitFrom === '0000000000000000000000000000000000000000') {
      if (action.commitData[0].parent !== '0000000000000000000000000000000000000000') {        
        cmd = `git diff ${action.commitData[0].parent} ${action.commitTo}`
      }
    }

    // Some push actions have no changes - so we need to check
    else {
      cmd = `git diff ${action.commitFrom} ${action.commitTo}`;
    }

    console.log(process.cwd());
    step.log(`executing "${cmd}" in foler ${path}`);

    // Get the diff
    const content = child.execSync(cmd, {
      cwd: path,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024 }).toString('utf-8');    
    
    step.log(`completed ${cmd}`);
    step.setContent(content);
  }
  catch (e) {
    console.error(e.stack || e);
    step.setError(e.message);
    throw e;
  }
  finally {
    action.addStep(step)
    return action;
  }
};

exec.displayName = 'getDiff.exec';
exports.exec = exec;
