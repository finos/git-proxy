const execSync = require('child_process').execSync;
const Step = require('../../actions').Step;

const exec = async (req, action) => {
  const step = new Step('writePack');
  try {
    const cmd = `git receive-pack ${action.repoName}`;
    step.log(`executing ${cmd}`);

    const content = execSync(
        `git receive-pack ${action.repoName}`, {
          cwd: action.proxyGitPath,
          input: req.body,
        },
    ).toString('utf-8');

    step.setContent(content);
  } catch (e) {
    console.log(e || e.stackTrace);
    step.setError(e.toString('utf-8'));
    throw e;
  } finally {
    action.addStep(step);
    return action;
  }
};

exec.displayName = 'writePack.exec';
exports.exec = exec;
