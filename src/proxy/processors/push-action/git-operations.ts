/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ChildProcess, spawn } from 'child_process';

/**
 * Git operations using native git commands
 */

/**
 * Build spawn environment, mapping NODE_TLS_REJECT_UNAUTHORIZED=0 to GIT_SSL_NO_VERIFY=1
 * so native git commands respect the same TLS settings as the Node.js process.
 */
function buildEnv(extraEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    env.GIT_SSL_NO_VERIFY = '1';
  }
  // Callers on the SSH path pass GIT_SSH_COMMAND here so that native git
  // authenticates through the client's forwarded agent.
  return { ...env, ...extraEnv };
}

/**
 * Build the environment that hands the client's Basic credentials to git.
 *
 * The credentials travel as an Authorization header set through GIT_CONFIG_*
 * variables, never in the URL: arguments are visible to every local user via
 * `ps`, and a URL with credentials would also be written to the repo config.
 * The header is scoped to the remote's origin, and credential helpers are
 * disabled so that a rejected token can never fall back to credentials stored
 * on the proxy host. The header is sent even when a field is empty (e.g. a token
 * as username with no password): without it curl would fall back to ~/.netrc.
 *
 * @param url The remote URL
 * @param username Client username
 * @param password Client password or token
 * @return Environment variables for git
 */
export function buildAuthEnv(url: string, username?: string, password?: string): NodeJS.ProcessEnv {
  const entries: Array<[string, string]> = [['credential.helper', '']];

  const origin = httpOrigin(url);
  if (origin && (username !== undefined || password !== undefined)) {
    const token = Buffer.from(`${username ?? ''}:${password ?? ''}`).toString('base64');
    entries.push([`http.${origin}/.extraHeader`, `Authorization: Basic ${token}`]);
  }

  const env: NodeJS.ProcessEnv = { GIT_CONFIG_COUNT: String(entries.length) };
  entries.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key;
    env[`GIT_CONFIG_VALUE_${index}`] = value;
  });
  return env;
}

/**
 * Origin of an HTTP(S) remote, or null for SSH URLs and local paths.
 */
function httpOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

export const GIT_TIMEOUT_MS = 60 * 60 * 1000;
export const KILL_GRACE_MS = 5000;

/** Git commands still running, killed if GitProxy exits first */
const running = new Set<ChildProcess>();
process.on('exit', () => running.forEach((proc) => killTree(proc, 'SIGKILL')));

function killTree(proc: ChildProcess, signal: NodeJS.Signals): void {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }).on(
        'error',
        () => proc.kill(),
      );
    } else {
      process.kill(-proc.pid!, signal);
    }
  } catch {
    // Already gone
  }
}

/**
 * Run a git command without blocking the event loop.
 *
 * @param args Arguments passed to git
 * @param env Extra environment variables for the child process
 * @param timeoutMs Kill git and reject once this many milliseconds have passed
 * @return Exit code and captured stderr
 */
function runGit(
  args: string[],
  env?: NodeJS.ProcessEnv,
  timeoutMs: number = GIT_TIMEOUT_MS,
): Promise<{ status: number; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: buildEnv(env),
      detached: process.platform !== 'win32',
    });
    running.add(proc);
    let stderr = '';
    let timedOut = false;
    let forceKill: NodeJS.Timeout | undefined;

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(proc, 'SIGTERM');
      forceKill = setTimeout(() => killTree(proc, 'SIGKILL'), KILL_GRACE_MS);
    }, timeoutMs);

    const done = () => {
      clearTimeout(timer);
      clearTimeout(forceKill);
      running.delete(proc);
    };

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', (error) => {
      done();
      reject(error);
    });
    proc.on('close', (code) => {
      done();
      if (timedOut) {
        reject(
          new Error(`git ${args.find((a) => !a.startsWith('-'))} timed out after ${timeoutMs}ms`),
        );
      } else {
        resolve({ status: code ?? 1, stderr });
      }
    });
  });
}

interface RemoteOptions {
  dir: string;
  url: string;
  username?: string;
  password?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

interface CloneOptions extends RemoteOptions {
  bare?: boolean;
}

interface FetchOptions extends RemoteOptions {
  prune?: boolean;
}

/**
 * Clone a repository using native git
 */
export async function clone(options: CloneOptions): Promise<void> {
  const { dir, url, username, password, bare = false, env, timeoutMs } = options;

  const args: string[] = ['clone'];

  if (bare) {
    args.push('--bare');
  }

  // '--' ends option parsing, so a url or dir starting with '-' (e.g. --upload-pack=...)
  // can never be interpreted as an option
  args.push('--', url, dir);

  const result = await runGit(
    args,
    { ...buildAuthEnv(url, username, password), ...env },
    timeoutMs,
  );
  if (result.status !== 0) {
    throw new Error(`Git clone failed: ${result.stderr || 'Unknown error'}`);
  }
}

/**
 * Fetch updates in a repository using native git
 */
export async function fetch(options: FetchOptions): Promise<void> {
  const { dir, url, username, password, prune = false, env, timeoutMs } = options;

  // --git-dir never falls back to an enclosing repository
  const args: string[] = [`--git-dir=${dir}`, 'fetch'];

  if (prune) {
    args.push('--prune');
  }

  // Mirror every branch and tag; --prune drops the ones deleted upstream
  args.push('--', url, '+refs/heads/*:refs/heads/*', '+refs/tags/*:refs/tags/*');

  const result = await runGit(
    args,
    { ...buildAuthEnv(url, username, password), ...env },
    timeoutMs,
  );
  if (result.status !== 0) {
    throw new Error(`Git fetch failed: ${result.stderr || 'Unknown error'}`);
  }
}

/**
 * Clone from local repository (for working copy from bare cache)
 */
export async function cloneLocal(options: {
  sourceDir: string;
  targetDir: string;
  timeoutMs?: number;
}): Promise<void> {
  const { sourceDir, targetDir, timeoutMs } = options;

  const result = await runGit(['clone', '--', sourceDir, targetDir], undefined, timeoutMs);
  if (result.status !== 0) {
    throw new Error(`Git local clone failed: ${result.stderr || 'Unknown error'}`);
  }
}

/**
 * Whether git can still read the repository's refs.
 */
export async function isReadableRepo(dir: string): Promise<boolean> {
  const result = await runGit([`--git-dir=${dir}`, 'for-each-ref', '--count=1']);
  return result.status === 0;
}
