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

import { describe, it, expect, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import fs from 'fs';
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
        '-C',
        '/tmp/m.git',
        'fetch',
        '--prune',
        '--',
        'https://github.com/a/b.git',
        '+refs/heads/*:refs/heads/*',
        '+refs/tags/*:refs/tags/*',
      ]);
    });

    it('reports a generic error when git prints nothing', async () => {
      spawnMock.mockImplementationOnce(fakeGit({ code: 1 }));

      await expect(
        gitOps.fetch({ dir: '/tmp/m.git', url: 'https://github.com/a/b.git' }),
      ).rejects.toThrow('Git fetch failed: Unknown error');
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
