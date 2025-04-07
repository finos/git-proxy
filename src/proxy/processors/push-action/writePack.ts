import { Action, Step } from '../../actions';
import { spawnSync } from 'child_process';

const exec = async (req: any, action: Action) => {
  const step = new Step('writePack');
  try {
    const cmd = `git receive-pack ${action.repoName}`;
    step.log(`executing ${cmd}`);

    const content = spawnSync('git', ['receive-pack', action.repoName], {
      cwd: action.proxyGitPath,
      input: req.body,
      encoding: 'utf-8',
    }).stdout;

    step.log(content);
    step.setContent(content);
  } catch (e: any) {
    step.setError(e.toString('utf-8'));
    throw e;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'writePack.exec';

export { exec };
