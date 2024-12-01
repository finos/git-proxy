const Step = require('../../actions').Step;
const simpleGit = require('simple-git')



const exec = async (req, action) => {
  const step = new Step('diff');

  try {
    const path = `${action.proxyGitPath}/${action.repoName}`;
    const git = simpleGit(path);
    // https://stackoverflow.com/questions/40883798/how-to-get-git-diff-of-the-first-commit
    let commitFrom = `4b825dc642cb6eb9a060e54bf8d69288fbee4904`;

    if (action.commitFrom === '0000000000000000000000000000000000000000') {
      if (action.commitData[0].parent !== '0000000000000000000000000000000000000000') {
        commitFrom = `${action.commitData[action.commitData.length - 1].parent}`;
      }
    } else {
      commitFrom = `${action.commitFrom}`;
    }

    step.log(`Executing "git diff ${commitFrom} ${action.commitTo}" in ${path}`);
    const revisionRange = `${commitFrom}..${action.commitTo}`;
    const diff = await git.diff([revisionRange]);
    step.log(diff);
    step.setContent(diff);
  } catch (e) {
    step.setError(e.toString('utf-8'));
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'getDiff.exec';
exports.exec = exec;
