import { Action, Step } from '../../actions';
import { getAPIs } from '../../../config';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { PathLike } from 'node:fs';

const EXIT_CODE = 99;

function runCommand(
  cwd: string,
  command: string,
  args: readonly string[] = [],
): Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: true });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data?.toString() ?? '';
    });

    child.stderr.on('data', (data) => {
      stderr += data?.toString() ?? '';
    });

    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

type ConfigOptions = {
  enabled: boolean;
  ignoreGitleaksAllow: boolean;
  noColor: boolean;
  configPath: string | undefined;
};

const DEFAULT_CONFIG: ConfigOptions = {
  // adding gitleaks into main git-proxy for now as default off
  // in the future will likely be moved to a plugin where it'll be default on
  enabled: false,
  ignoreGitleaksAllow: true,
  noColor: false,
  configPath: undefined,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function fileIsReadable(path: PathLike): Promise<boolean> {
  try {
    if (!(await fs.stat(path)).isFile()) {
      return false;
    }
    await fs.access(path, fs.constants.R_OK);
    return true;
  } catch (e) {
    return false;
  }
}

const getPluginConfig = async (): Promise<ConfigOptions> => {
  const userConfig = getAPIs();
  if (typeof userConfig !== 'object') {
    return DEFAULT_CONFIG;
  }
  if (!Object.hasOwn(userConfig, 'gitleaks')) {
    return DEFAULT_CONFIG;
  }
  const gitleaksConfig = userConfig.gitleaks;
  if (!isRecord(gitleaksConfig)) {
    return DEFAULT_CONFIG;
  }

  let configPath: string | undefined = undefined;
  if (typeof gitleaksConfig.configPath === 'string') {
    const userConfigPath = gitleaksConfig.configPath.trim();
    if (userConfigPath.length > 0 && (await fileIsReadable(userConfigPath))) {
      configPath = userConfigPath;
    } else {
      console.error('could not read file at the config path provided, will not be fed to gitleaks');
      throw new Error("could not check user's config path");
    }
  }

  // TODO: integrate zod
  return {
    enabled:
      typeof gitleaksConfig.enabled === 'boolean' ? gitleaksConfig.enabled : DEFAULT_CONFIG.enabled,
    ignoreGitleaksAllow:
      typeof gitleaksConfig.ignoreGitleaksAllow === 'boolean'
        ? gitleaksConfig.ignoreGitleaksAllow
        : DEFAULT_CONFIG.ignoreGitleaksAllow,
    noColor:
      typeof gitleaksConfig.noColor === 'boolean' ? gitleaksConfig.noColor : DEFAULT_CONFIG.noColor,
    configPath,
  };
};

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('gitleaks');

  let config: ConfigOptions | undefined = undefined;
  try {
    config = await getPluginConfig();
  } catch (e) {
    console.error('failed to get gitleaks config, please fix the error:', e);
    action.error = true;
    step.setError('failed setup gitleaks, please contact an administrator\n');
    action.addStep(step);
    return action;
  }

  const { commitFrom, commitTo } = action;
  const workingDir = `${action.proxyGitPath}/${action.repoName}`;
  console.log(`Scanning range with gitleaks: ${commitFrom}:${commitTo}`, workingDir);

  try {
    const gitRootCommit = await runCommand(workingDir, 'git', [
      'rev-list',
      '--max-parents=0',
      'HEAD',
    ]);
    if (gitRootCommit.exitCode !== 0) {
      throw new Error('failed to run git');
    }
    const rootCommit = gitRootCommit.stdout.trim();

    const gitleaksArgs = [
      `--exit-code=${EXIT_CODE}`,
      '--platform=none',
      config.configPath ? `--config=${config.configPath}` : undefined, // allow for custom config
      config.ignoreGitleaksAllow ? '--ignore-gitleaks-allow' : undefined, // force scanning for security
      '--no-banner', // reduce git-proxy error output
      config.noColor ? '--no-color' : undefined, // colour output should appear properly in the console
      '--redact', // avoid printing the contents
      '--verbose',
      'git',
      // not using --no-merges to be sure we're scanning the diff
      // only add ^ if the commitFrom isn't the repo's rootCommit
      `--log-opts='--first-parent ${rootCommit === commitFrom ? rootCommit : `${commitFrom}^`}..${commitTo}'`,
    ].filter((v) => typeof v === 'string');
    const gitleaks = await runCommand(workingDir, 'gitleaks', gitleaksArgs);

    if (gitleaks.exitCode !== 0) {
      // any failure
      step.error = true;
      if (gitleaks.exitCode !== EXIT_CODE) {
        step.setError('failed to run gitleaks, please contact an administrator\n');
      } else {
        // exit code matched our gitleaks findings exit code
        // newline prefix to avoid tab indent at the start
        step.setError('\n' + gitleaks.stdout + gitleaks.stderr);
      }
    } else {
      console.log('succeded');
      console.log(gitleaks.stderr);
    }
  } catch (e) {
    action.error = true;
    step.setError('failed to spawn gitleaks, please contact an administrator\n');
    action.addStep(step);
    return action;
  }

  action.addStep(step);
  return action;
};

exec.displayName = 'gitleaks.exec';

export { exec };
