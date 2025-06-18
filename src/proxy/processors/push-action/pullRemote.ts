import { Action, Step } from '../../actions';
import fs from 'fs';
import git from 'isomorphic-git';
import gitHttpClient from 'isomorphic-git/http/node';
import execSync from 'child_process';

const dir = './.remote';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('pullRemote');

  try {
    action.proxyGitPath = `${dir}/${action.timestamp}`;

    step.log(`Creating folder ${action.proxyGitPath}`);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    if (!fs.existsSync(action.proxyGitPath)) {
      fs.mkdirSync(action.proxyGitPath, 0o755);
    }

    let cloneUrl = action.url;
    let cmd = 'git clone';

    if (action.protocol === 'ssh') {
      // Convert HTTPS URL to SSH URL
      cloneUrl = action.url.replace('https://', 'git@');
      cmd += ` ${cloneUrl}`;
      step.log(`Executing ${cmd}`);

      // Use native git command with SSH
      execSync(cmd, {
        cwd: action.proxyGitPath,
        stdio: 'pipe',
      });
    } else {
      cmd += ` ${action.url}`;
      step.log(`Exectuting ${cmd}`);

      const authHeader = req.headers?.authorization;
      const [username, password] = Buffer.from(authHeader.split(' ')[1], 'base64')
        .toString()
        .split(':');

      await git.clone({
        fs,
        http: gitHttpClient,
        url: action.url,
        onAuth: () => ({
          username,
          password,
        }),
        dir: `${action.proxyGitPath}/${action.repoName}`,
      });
    }

    console.log('Clone Success: ', cloneUrl);

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
