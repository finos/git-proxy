import { Request } from 'express';
import fs from 'fs';
import git from 'isomorphic-git';
import gitHttpClient from 'isomorphic-git/http/node';

import { Action, Step } from '../../actions';

const dir = './.remote';

const exec = async (req: Request, action: Action): Promise<Action> => {
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

    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64')
      .toString()
      .split(':');

    await git.clone({
      fs,
      http: gitHttpClient,
      url: action.url,
      dir: `${action.proxyGitPath}/${action.repoName}`,
      onAuth: () => ({ username, password }),
      singleBranch: true,
      depth: 1,
    });

    step.log(`Completed ${cmd}`);
    step.setContent(`Completed ${cmd}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    step.setError(msg);
    throw error;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'pullRemote.exec';

export { exec };
