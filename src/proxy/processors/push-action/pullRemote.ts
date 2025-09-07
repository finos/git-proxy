import { Action, Step } from '../../actions';
import fs from 'fs';
import git from 'isomorphic-git';
import gitHttpClient from 'isomorphic-git/http/node';

const dir = './.remote';

const exec = async (req: any, action: Action): Promise<Action> => {
  console.log('TIME: pullRemoteStart');
  const startTime = Date.now();
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

    if (!fs.existsSync(`${action.proxyGitPath}/${action.repoName}`)) {
      console.log('Clone: ', action.url);
      await git.clone({
        fs,
        http: gitHttpClient,
        url: action.url,
        dir: `${action.proxyGitPath}/${action.repoName}`,
        onAuth: () => ({ username, password }),
        singleBranch: true,
        depth: 1,
      });
    } else {
      console.log('Fetch: ', action.url);
      await git.fetch({
        fs,
        http: gitHttpClient,
        url: action.url,
        dir: `${action.proxyGitPath}/${action.repoName}`,
        onAuth: () => ({ username, password }),
        singleBranch: true,
        depth: 1,
      });
    }

    console.log('Clone/Fetch Success: ', action.url);

    step.log(`Completed ${cmd}`);
    step.setContent(`Completed ${cmd}`);
  } catch (e: any) {
    step.setError(e.toString('utf-8'));
    throw e;
  } finally {
    action.addStep(step);
  }
  const endTime = Date.now();
  const duration = endTime - startTime;
  console.log(`TIME: pullRemote completed in ${duration}ms`);
  return action;
};

exec.displayName = 'pullRemote.exec';

export { exec };
