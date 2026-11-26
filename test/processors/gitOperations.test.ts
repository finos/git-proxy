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

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import fs from 'fs';
import http from 'http';
import { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import * as childProcess from 'child_process';

import * as gitOps from '../../src/proxy/processors/push-action/git-operations';

// Wrap the real spawn so tests can inspect argv/env or replace the child process
vi.mock('child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('child_process')>();
  return { ...original, spawn: vi.fn(original.spawn) };
});

const spawnMock = vi.mocked(childProcess.spawn);
const { spawn: realSpawn } = await vi.importActual<typeof import('child_process')>('child_process');

/** A fake git process that exits with the given code (or emits a spawn error). */
const fakeGit = (outcome: { code?: number; stderr?: string; error?: Error }) =>
  (() => {
    const proc = new EventEmitter() as any;
    proc.stderr = new EventEmitter();
    setImmediate(() => {
      if (outcome.error) {
        proc.emit('error', outcome.error);
        return;
      }
      if (outcome.stderr) proc.stderr.emit('data', Buffer.from(outcome.stderr));
      proc.emit('close', outcome.code ?? 0);
    });
    return proc;
  }) as any;

const lastCall = () => {
  const [command, args, options] = spawnMock.mock.calls.at(-1)!;
  return { command, args: args as string[], env: (options as any).env as NodeJS.ProcessEnv };
};

const configEntries = (env: NodeJS.ProcessEnv) =>
  Array.from({ length: Number(env.GIT_CONFIG_COUNT) }, (_, i) => [
    env[`GIT_CONFIG_KEY_${i}`],
    env[`GIT_CONFIG_VALUE_${i}`],
  ]);

describe('git-operations', () => {
  afterEach(() => {
    spawnMock.mockClear();
    vi.unstubAllEnvs();
  });

  describe('buildAuthEnv', () => {
    it('passes Basic credentials as a header scoped to the remote origin', () => {
      const env = gitOps.buildAuthEnv('https://github.com/finos/git-proxy.git', 'user', 's3cr3t');
      const token = Buffer.from('user:s3cr3t').toString('base64');

      expect(configEntries(env)).toEqual([
        ['credential.helper', ''],
        ['http.https://github.com/.extraHeader', `Authorization: Basic ${token}`],
      ]);
    });

    it('keeps the port in the header scope', () => {
      const env = gitOps.buildAuthEnv('https://git.internal:8443/team/app.git', 'u', 'p');

      expect(configEntries(env)[1][0]).toBe('http.https://git.internal:8443/.extraHeader');
    });

    it.each([
      ['a token as username with no password', 'ghp_token', '', 'ghp_token:'],
      ['an empty username with a token as password', '', 'pat', ':pat'],
    ])('still sends the header for %s', (_case, username, password, raw) => {
      const env = gitOps.buildAuthEnv('https://github.com/a/b.git', username, password);

      expect(configEntries(env)[1]).toEqual([
        'http.https://github.com/.extraHeader',
        `Authorization: Basic ${Buffer.from(raw).toString('base64')}`,
      ]);
    });

    // Relies on ~/.netrc, which is _netrc on Windows
    it.skipIf(process.platform === 'win32')(
      "never lets git fall back to the proxy host's ~/.netrc",
      async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-proxy-netrc-'));
        fs.writeFileSync(
          path.join(root, '.netrc'),
          'machine 127.0.0.1\nlogin hostuser\npassword hostsecret\n',
          { mode: 0o600 },
        );

        // Records the Authorization header of every request and always asks for credentials
        const received: Array<string | undefined> = [];
        const server = http.createServer((req, res) => {
          received.push(req.headers.authorization);
          res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="git"' }).end();
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address() as AddressInfo;

        try {
          await expect(
            gitOps.clone({
              dir: path.join(root, 'out.git'),
              url: `http://127.0.0.1:${port}/repo.git`,
              username: 'client',
              password: '',
              bare: true,
              env: { HOME: root, GIT_CONFIG_NOSYSTEM: '1' },
            }),
          ).rejects.toThrow(/Git clone failed/);

          const client = `Basic ${Buffer.from('client:').toString('base64')}`;
          expect(received.length).toBeGreaterThan(0);
          expect(received.every((header) => header === client)).toBe(true);
        } finally {
          server.close();
          fs.rmSync(root, { recursive: true, force: true });
        }
      },
    );

    it('only disables credential helpers when there are no credentials', () => {
      expect(configEntries(gitOps.buildAuthEnv('https://github.com/a/b.git'))).toEqual([
        ['credential.helper', ''],
      ]);
    });

    it('never adds a header for SSH URLs or local paths', () => {
      for (const url of ['git@github.com:finos/git-proxy.git', '/tmp/repo.git']) {
        expect(configEntries(gitOps.buildAuthEnv(url, 'u', 'p'))).toEqual([
          ['credential.helper', ''],
        ]);
      }
    });
  });

  describe('clone', () => {
    it('keeps credentials out of the command line', async () => {
      spawnMock.mockImplementationOnce(fakeGit({ code: 0 }));

      await gitOps.clone({
        dir: '/tmp/out.git',
        url: 'https://github.com/finos/git-proxy.git',
        username: 'user',
        password: 's3cr3t',
        bare: true,
      });

      const { command, args, env } = lastCall();
      expect(command).toBe('git');
      expect(args).toEqual([
        'clone',
        '--bare',
        '--',
        'https://github.com/finos/git-proxy.git',
        '/tmp/out.git',
      ]);
      expect(args.join(' ')).not.toContain('s3cr3t');
      expect(Object.values(env).join(' ')).toContain(Buffer.from('user:s3cr3t').toString('base64'));
      expect(env.GIT_TERMINAL_PROMPT).toBe('0');
    });

    it('lets callers add environment such as GIT_SSH_COMMAND', async () => {
      spawnMock.mockImplementationOnce(fakeGit({ code: 0 }));

      await gitOps.clone({
        dir: '/tmp/out.git',
        url: 'git@github.com:finos/git-proxy.git',
        env: { GIT_SSH_COMMAND: 'ssh -F cfg' },
      });

      expect(lastCall().env.GIT_SSH_COMMAND).toBe('ssh -F cfg');
      expect(lastCall().args).not.toContain('--bare');
    });

    it('maps NODE_TLS_REJECT_UNAUTHORIZED=0 to GIT_SSL_NO_VERIFY', async () => {
      vi.stubEnv('NODE_TLS_REJECT_UNAUTHORIZED', '0');
      spawnMock.mockImplementationOnce(fakeGit({ code: 0 }));

      await gitOps.clone({ dir: '/tmp/out.git', url: 'https://github.com/a/b.git' });

      expect(lastCall().env.GIT_SSL_NO_VERIFY).toBe('1');
    });

    // Relies on `touch` and POSIX file:// paths
    it.skipIf(process.platform === 'win32')(
      'never treats an argument starting with "-" as a git option',
      async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'git-proxy-argv-'));
        const marker = path.join(root, 'pwned');
        const realRepo = `file://${path.join(root, 'src.git')}`;
        childProcess.execFileSync('git', ['init', '--bare', '-q', path.join(root, 'src.git')]);

        // Run from the temp folder: git derives a destination dir from the repo name in the cwd
        const cwd = process.cwd();
        process.chdir(root);

        try {
          // Without '--' git parses the url as --upload-pack, clones realRepo and runs `touch`
          await expect(
            gitOps.clone({ url: `--upload-pack=touch ${marker}`, dir: realRepo }),
          ).rejects.toThrow(/Git clone failed/);

          expect(fs.existsSync(marker)).toBe(false);
        } finally {
          process.chdir(cwd);
          fs.rmSync(root, { recursive: true, force: true });
        }
      },
    );

    it('reports git stderr when the clone fails', async () => {
      spawnMock.mockImplementationOnce(fakeGit({ code: 128, stderr: 'fatal: not found' }));

      await expect(
        gitOps.clone({ dir: '/tmp/out.git', url: 'https://github.com/a/b.git' }),
      ).rejects.toThrow('Git clone failed: fatal: not found');
    });

    it('rejects when git cannot be started', async () => {
      spawnMock.mockImplementationOnce(fakeGit({ error: new Error('spawn git ENOENT') }));

      await expect(
        gitOps.clone({ dir: '/tmp/out.git', url: 'https://github.com/a/b.git' }),
      ).rejects.toThrow('ENOENT');
    });
  });

  describe('fetch', () => {
    it('mirrors branches and tags, pruning deleted ones', async () => {
      spawnMock.mockImplementationOnce(fakeGit({ code: 0 }));

      await gitOps.fetch({ dir: '/tmp/m.git', url: 'https://github.com/a/b.git', prune: true });

      expect(lastCall().args).toEqual([
        '--git-dir=/tmp/m.git',
        'fetch',
        '--prune',
        '--',
        'https://github.com/a/b.git',
        '+refs/heads/*:refs/heads/*',
        '+refs/tags/*:refs/tags/*',
      ]);
    });

    describe.skipIf(process.platform === 'win32')('when git hangs', () => {
      const root = path.join(os.tmpdir(), `git-proxy-hang-${process.pid}`);
      const pidFile = path.join(root, 'helper.pid');

      const isAlive = (pid: number) => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      };
      const until = async (check: () => boolean) => {
        const start = Date.now();
        while (!check() && Date.now() - start < 5000) {
          await new Promise((resolve) => setImmediate(resolve));
        }
      };
      const helperPid = () => Number(fs.readFileSync(pidFile, 'utf8'));
      const hangingGit = (script: string) =>
        spawnMock.mockImplementationOnce(((_cmd: string, _args: string[], options: any) =>
          realSpawn(
            'sh',
            ['-c', `${script} sleep 30 & echo $! > ${pidFile}; wait`],
            options,
          )) as any);

      beforeEach(() => fs.mkdirSync(root, { recursive: true }));
      afterEach(() => {
        vi.useRealTimers();
        fs.rmSync(root, { recursive: true, force: true });
      });

      it('kills git together with its helpers before rejecting', async () => {
        hangingGit('');

        await expect(
          gitOps.fetch({ dir: '/tmp/m.git', url: 'https://github.com/a/b.git', timeoutMs: 300 }),
        ).rejects.toThrow('git fetch timed out after 300ms');

        await until(() => !isAlive(helperPid()));
        expect(isAlive(helperPid())).toBe(false);
      });

      it('escalates to SIGKILL when git ignores SIGTERM', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        hangingGit("trap '' TERM;");

        const fetching = expect(
          gitOps.fetch({ dir: '/tmp/m.git', url: 'https://github.com/a/b.git', timeoutMs: 1000 }),
        ).rejects.toThrow('timed out');
        await until(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8') !== '');

        vi.advanceTimersByTime(1000); // SIGTERM, ignored
        await new Promise((resolve) => setImmediate(resolve));
        expect(isAlive(helperPid())).toBe(true);

        vi.advanceTimersByTime(gitOps.KILL_GRACE_MS); // SIGKILL
        await fetching;
        await until(() => !isAlive(helperPid()));
        expect(isAlive(helperPid())).toBe(false);
      });
    });

    it('reports a generic error when git prints nothing', async () => {
      spawnMock.mockImplementationOnce(fakeGit({ code: 1 }));

      await expect(
        gitOps.fetch({ dir: '/tmp/m.git', url: 'https://github.com/a/b.git' }),
      ).rejects.toThrow('Git fetch failed: Unknown error');
    });
  });

  describe('isReadableRepo', () => {
    const root = path.join(os.tmpdir(), `git-proxy-readable-${process.pid}`);
    const repo = path.join(root, 'repo.git');

    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('accepts a healthy, even empty, repository', async () => {
      childProcess.execFileSync('git', ['init', '--bare', '-q', repo]);
      expect(await gitOps.isReadableRepo(repo)).toBe(true);
    });

    it('rejects a repository whose refs cannot be read', async () => {
      childProcess.execFileSync('git', ['init', '--bare', '-q', repo]);
      fs.writeFileSync(path.join(repo, 'packed-refs'), 'garbage');
      expect(await gitOps.isReadableRepo(repo)).toBe(false);
    });

    it('rejects a folder that is not a repository', async () => {
      fs.mkdirSync(repo, { recursive: true });
      expect(await gitOps.isReadableRepo(repo)).toBe(false);
    });

    it('never falls back to an enclosing repository', async () => {
      // Like a corrupted mirror in the cache folder inside the GitProxy checkout
      childProcess.execFileSync('git', ['init', '-q', root]);
      const nested = path.join(root, '.remote', 'cache', 'm.git');
      childProcess.execFileSync('git', ['init', '--bare', '-q', nested]);
      fs.writeFileSync(path.join(nested, 'HEAD'), 'garbage');

      expect(await gitOps.isReadableRepo(nested)).toBe(false);
      await expect(gitOps.fetch({ dir: nested, url: repo, prune: true })).rejects.toThrow(
        /not a git repository/,
      );
    });
  });

  describe('checkGitVersion', () => {
    const gitPrints = (output: string | Error) =>
      spawnMock.mockImplementationOnce((() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        setImmediate(() => {
          if (output instanceof Error) {
            proc.emit('error', output);
            return;
          }
          proc.stdout.emit('data', Buffer.from(`${output}\n`));
          proc.emit('close', 0);
        });
        return proc;
      }) as any);

    it.each([
      'git version 2.31.0',
      'git version 2.39.5 (Apple Git-154)',
      'git version 2.45.0.windows.1',
      'git version 3.0.0',
    ])('accepts %s', async (output) => {
      gitPrints(output);
      await expect(gitOps.checkGitVersion()).resolves.toBeUndefined();
    });

    it.each(['git version 2.30.2', 'git version 1.9.5'])('rejects %s', async (output) => {
      gitPrints(output);
      await expect(gitOps.checkGitVersion()).rejects.toThrow(
        `The repository cache needs git 2.31 or later, found: ${output}`,
      );
    });

    it('rejects when git is not installed', async () => {
      gitPrints(new Error('spawn git ENOENT'));

      await expect(gitOps.checkGitVersion()).rejects.toThrow('found: none (spawn git ENOENT)');
    });
  });

  describe('cloneLocal', () => {
    it('fails with the real git error for a missing source', async () => {
      await expect(
        gitOps.cloneLocal({ sourceDir: '/nonexistent/source.git', targetDir: '/tmp/never' }),
      ).rejects.toThrow(/Git local clone failed: .*(does not exist|not found|fatal)/);
    });
  });
});
