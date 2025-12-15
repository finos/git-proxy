import { Action, Step } from '../../actions';
import fs from 'fs';
import git from 'isomorphic-git';
import gitHttpClient from 'isomorphic-git/http/node';

const dir = './.remote';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('pullRemote');

  try {
    action.proxyGitPath = `${dir}/${action.id}`;

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    if (!fs.existsSync(action.proxyGitPath)) {
      step.log(`Creating folder ${action.proxyGitPath}`);
      fs.mkdirSync(action.proxyGitPath, 0o755);
    }

    const cmd = `git clone ${action.url}`;
    step.log(`Executing ${cmd}`);

    const authHeader = req.headers?.authorization;
    const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64')
      .toString()
      .split(':');

    // Note: setting singleBranch to true will cause issues when pushing to
    // a non-default branch as commits from those branches won't be fetched
    await git.clone({
      fs,
      http: gitHttpClient,
      url: action.url,
      dir: `${action.proxyGitPath}/${action.repoName}`,
      onAuth: () => ({ username, password }),
      depth: 1,
    });

    step.log(`Completed ${cmd}`);
    step.setContent(`Completed ${cmd}`);
  } catch (e: any) {
    step.setError(e.toString('utf-8'));
    throw e;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'pullRemote.exec';

export { exec };
