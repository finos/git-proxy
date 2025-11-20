import { Action, Step } from '../../actions';
import fs from 'fs';
import git from 'isomorphic-git';
import gitHttpClient from 'isomorphic-git/http/node';

const dir = './.remote';

type BasicCredentials = {
  username: string;
  password: string;
};

type CloneResult = {
  command: string;
  strategy: Action['pullAuthStrategy'];
};

const ensureDirectory = async (targetPath: string) => {
  await fs.promises.mkdir(targetPath, { recursive: true, mode: 0o755 });
};

const decodeBasicAuth = (authHeader?: string): BasicCredentials | null => {
  if (!authHeader) {
    return null;
  }

  const [scheme, encoded] = authHeader.split(' ');
  if (!scheme || !encoded || scheme.toLowerCase() !== 'basic') {
    throw new Error('Invalid Authorization header format');
  }

  const credentials = Buffer.from(encoded, 'base64').toString();
  const separatorIndex = credentials.indexOf(':');
  if (separatorIndex === -1) {
    throw new Error('Invalid Authorization header credentials');
  }

  return {
    username: credentials.slice(0, separatorIndex),
    password: credentials.slice(separatorIndex + 1),
  };
};

const cloneWithHTTPS = async (
  action: Action,
  credentials: BasicCredentials | null,
): Promise<void> => {
  const cloneOptions: any = {
    fs,
    http: gitHttpClient,
    url: action.url,
    dir: `${action.proxyGitPath}/${action.repoName}`,
    singleBranch: true,
    depth: 1,
    onAuth: credentials ? () => credentials : undefined,
  };

  await git.clone(cloneOptions);
};

const handleSSHClone = async (req: any, action: Action, step: Step): Promise<CloneResult> => {
  const authContext = req?.authContext ?? {};

  // Try service token first (if configured)
  const serviceToken = authContext?.cloneServiceToken;
  if (serviceToken?.username && serviceToken?.password) {
    step.log('Cloning repository over HTTPS using configured service token');
    await cloneWithHTTPS(action, {
      username: serviceToken.username,
      password: serviceToken.password,
    });
    return {
      command: `git clone ${action.url}`,
      strategy: 'ssh-service-token',
    };
  }

  // Try anonymous HTTPS clone (for public repos)
  step.log('No service token available; attempting anonymous HTTPS clone');
  try {
    await cloneWithHTTPS(action, null);
    return {
      command: `git clone ${action.url}`,
      strategy: 'anonymous',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Unable to clone repository: ${message}. Please configure a service token in proxy.config.json for private repositories.`,
    );
  }
};

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('pullRemote');

  try {
    action.proxyGitPath = `${dir}/${action.id}`;

    await ensureDirectory(dir);
    await ensureDirectory(action.proxyGitPath);

    let result: CloneResult;

    if (action.protocol === 'ssh') {
      result = await handleSSHClone(req, action, step);
    } else {
      const credentials = decodeBasicAuth(req.headers?.authorization);
      if (!credentials) {
        throw new Error('Missing Authorization header for HTTPS clone');
      }
      step.log('Cloning repository over HTTPS using client credentials');
      await cloneWithHTTPS(action, credentials);
      result = {
        command: `git clone ${action.url}`,
        strategy: 'basic',
      };
    }

    action.pullAuthStrategy = result.strategy;
    step.log(`Completed ${result.command}`);
    step.setContent(`Completed ${result.command}`);
  } catch (e: any) {
    const message = e instanceof Error ? e.message : (e?.toString?.('utf-8') ?? String(e));
    step.setError(message);
    throw e;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'pullRemote.exec';
export { exec };
