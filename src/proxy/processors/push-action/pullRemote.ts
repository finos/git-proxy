import { Action, Step } from '../../actions';
import fs from 'fs';
import git from 'isomorphic-git';
import gitHttpClient from 'isomorphic-git/http/node';
import path from 'path';
import os from 'os';
import { simpleGit } from 'simple-git';

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

const buildSSHCloneUrl = (remoteUrl: string): string => {
  const parsed = new URL(remoteUrl);
  const repoPath = parsed.pathname.replace(/^\//, '');
  return `git@${parsed.hostname}:${repoPath}`;
};

const cleanupTempDir = async (tempDir: string) => {
  await fs.promises.rm(tempDir, { recursive: true, force: true });
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

const cloneWithSSHKey = async (action: Action, privateKey: Buffer): Promise<void> => {
  if (!privateKey || privateKey.length === 0) {
    throw new Error('SSH private key is empty');
  }

  const keyBuffer = Buffer.isBuffer(privateKey) ? privateKey : Buffer.from(privateKey);
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'git-proxy-ssh-clone-'));
  const keyPath = path.join(tempDir, 'id_rsa');

  await fs.promises.writeFile(keyPath, keyBuffer, { mode: 0o600 });

  const originalGitSSH = process.env.GIT_SSH_COMMAND;
  process.env.GIT_SSH_COMMAND = `ssh -i ${keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`;

  try {
    const gitClient = simpleGit(action.proxyGitPath);
    await gitClient.clone(buildSSHCloneUrl(action.url), action.repoName, [
      '--depth',
      '1',
      '--single-branch',
    ]);
  } finally {
    if (originalGitSSH) {
      process.env.GIT_SSH_COMMAND = originalGitSSH;
    } else {
      delete process.env.GIT_SSH_COMMAND;
    }
    await cleanupTempDir(tempDir);
  }
};

const handleSSHClone = async (req: any, action: Action, step: Step): Promise<CloneResult> => {
  const authContext = req?.authContext ?? {};
  const sshKey = authContext?.sshKey;

  if (sshKey?.keyData || sshKey?.privateKey) {
    const keyData = sshKey.keyData ?? sshKey.privateKey;
    step.log('Cloning repository over SSH using caller credentials');
    await cloneWithSSHKey(action, keyData);
    return {
      command: `git clone ${buildSSHCloneUrl(action.url)}`,
      strategy: 'ssh-user-key',
    };
  }

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

  step.log('No SSH clone credentials available; attempting anonymous HTTPS clone');
  try {
    await cloneWithHTTPS(action, null);
  } catch (error) {
    const err =
      error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : 'Unknown clone error');
    err.message = `Unable to clone repository for SSH push without credentials: ${err.message}`;
    throw err;
  }
  return {
    command: `git clone ${action.url}`,
    strategy: 'anonymous',
  };
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
