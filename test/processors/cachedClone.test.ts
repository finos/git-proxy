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
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import * as config from '../../src/config';
import { Action, RequestType, Step } from '../../src/proxy/actions';
import {
  cacheKeyFor,
  performCachedClone,
} from '../../src/proxy/processors/push-action/cachedClone';
import { cacheManager } from '../../src/proxy/processors/push-action/cache-manager';
import {
  createPullRemote,
  exec as pullRemote,
} from '../../src/proxy/processors/push-action/pullRemote';
import { exec as clearBareClone } from '../../src/proxy/processors/post-processor/clearBareClone';
import { PullRemoteHTTPS } from '../../src/proxy/processors/push-action/PullRemoteHTTPS';
import { PullRemoteSSH } from '../../src/proxy/processors/push-action/PullRemoteSSH';
import { PullRemoteHTTPSCached } from '../../src/proxy/processors/push-action/PullRemoteHTTPSCached';
import { PullRemoteSSHCached } from '../../src/proxy/processors/push-action/PullRemoteSSHCached';

const { testRoot, testCacheDir } = await vi.hoisted(async () => {
  const nodePath = await import('path');
  const nodeOs = await import('os');
  const root = nodePath.join(nodeOs.tmpdir(), `git-proxy-cached-clone-${process.pid}`);
  return { testRoot: root, testCacheDir: nodePath.join(root, 'cache') };
});

// Point the shared cache manager at a throwaway folder instead of ./.repo-cache
vi.mock('../../src/proxy/processors/push-action/cache-manager', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/proxy/processors/push-action/cache-manager')>();
  return {
    ...original,
    cacheManager: new original.CacheManager(testCacheDir, 1, 50),
  };
});

const actionFor = (url: string, id = 'id'): Action =>
  new Action(id, RequestType.PUSH, 'POST', Date.now(), url);

const sshReq = { sshClient: { agentForwardingEnabled: true } } as any;

describe('cacheKeyFor', () => {
  it('keeps repositories from different projects apart', () => {
    const finos = actionFor('https://github.com/finos/git-proxy.git');
    const other = actionFor('https://github.com/acme/git-proxy.git');

    expect(finos.repoName).toBe(other.repoName);
    expect(cacheKeyFor(finos)).not.toBe(cacheKeyFor(other));
  });

  it('keeps repositories from different hosts apart', () => {
    const github = actionFor('https://github.com/finos/git-proxy.git');
    const gitlab = actionFor('https://gitlab.com/finos/git-proxy.git');

    expect(github.project).toBe(gitlab.project);
    expect(github.repoName).toBe(gitlab.repoName);
    expect(cacheKeyFor(github)).not.toBe(cacheKeyFor(gitlab));
  });

  it('includes the host and project in the key', () => {
    const action = actionFor('https://github.com/finos/git-proxy.git');

    expect(cacheKeyFor(action)).toMatch(/^github\.com__finos__git-proxy\.git-[0-9a-f]{64}$/);
  });

  it('keeps the port of self-hosted remotes, sanitised', () => {
    const action = actionFor('https://git.internal:8443/team/app.git');

    expect(cacheKeyFor(action)).toMatch(/^git\.internal-8443__team__app\.git-[0-9a-f]{64}$/);
  });

  it('falls back to host and repository name when there is no project', () => {
    const action = actionFor('https://github.com/finos/git-proxy.git');
    action.project = '';

    expect(cacheKeyFor(action)).toMatch(/^github\.com__git-proxy\.git-[0-9a-f]{64}$/);
  });

  it('keeps paths apart that sanitise to the same name', () => {
    const pairs = [
      ['https://gitlab.com/a/b/c.git', 'https://gitlab.com/a-b/c.git'],
      ['https://github.com/x__y/z.git', 'https://github.com/x/y__z.git'],
    ];

    for (const [one, two] of pairs) {
      expect(cacheKeyFor(actionFor(one))).not.toBe(cacheKeyFor(actionFor(two)));
    }
  });

  it('cuts long names short but still keeps them apart', () => {
    const group = 'a'.repeat(100);
    const one = cacheKeyFor(actionFor(`https://gitlab.com/${group}/one.git`));
    const two = cacheKeyFor(actionFor(`https://gitlab.com/${group}/two.git`));

    expect(one).toHaveLength(64 + 1 + 64);
    expect(one).not.toBe(two);
  });

  it('is stable for the same repository', () => {
    const url = 'https://github.com/finos/git-proxy.git';

    expect(cacheKeyFor(actionFor(url, 'a'))).toBe(cacheKeyFor(actionFor(url, 'b')));
  });

  it('produces a flat, filesystem-safe name', () => {
    const action = actionFor('https://gitlab.com/group/sub group/repo.git');
    const key = cacheKeyFor(action);

    expect(key).not.toContain('/');
    expect(key).toMatch(/^[\w.-]+$/);
  });
});

describe('performCachedClone', () => {
  const remote = path.join(testRoot, 'remote.git');
  const seed = path.join(testRoot, 'seed');
  const cacheDir = path.join(testRoot, 'cache');
  const repoUrl = 'https://example.com/acme/app.git';
  const bareRepo = path.join(cacheDir, cacheKeyFor(actionFor(repoUrl)));

  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd,
      stdio: 'pipe',
    });

  const commit = (file: string) => {
    fs.writeFileSync(path.join(seed, file), file);
    git(seed, 'add', file);
    git(seed, 'commit', '-m', file);
    git(seed, 'push', 'origin', 'HEAD:refs/heads/main');
  };

  let counter = 0;
  const newPush = () => {
    const action = actionFor(repoUrl, `push-${++counter}`);
    action.proxyGitPath = path.join(testRoot, 'work', action.id);
    fs.mkdirSync(action.proxyGitPath, { recursive: true });
    return action;
  };

  const workCopyOf = (action: Action) => path.join(action.proxyGitPath!, action.repoName);
  const stagingLeftovers = () =>
    fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir).filter((n) => n.startsWith('.')) : [];

  beforeEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
    fs.mkdirSync(seed, { recursive: true });
    execFileSync('git', ['init', '--bare', '-b', 'main', remote], { stdio: 'pipe' });
    git(seed, 'init', '-b', 'main');
    git(seed, 'remote', 'add', 'origin', remote);
    commit('first.txt');
  });

  afterEach(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  it('creates the bare mirror and a working copy on a cache miss', async () => {
    const action = newPush();

    const result = await performCachedClone(
      action,
      new Step('pullRemote'),
      { url: remote },
      'basic',
    );

    expect(result.command).toContain('git clone --bare');
    expect(result.strategy).toBe('basic');
    expect(fs.existsSync(path.join(bareRepo, 'HEAD'))).toBe(true);
    expect(fs.existsSync(path.join(workCopyOf(action), 'first.txt'))).toBe(true);
    expect(stagingLeftovers()).toEqual([]);
  });

  it('fetches new commits into the existing mirror on a cache hit', async () => {
    await performCachedClone(newPush(), new Step('pullRemote'), { url: remote }, 'basic');
    const inodeBefore = fs.statSync(bareRepo).ino;

    commit('second.txt');
    const action = newPush();
    const result = await performCachedClone(
      action,
      new Step('pullRemote'),
      { url: remote },
      'basic',
    );

    expect(result.command).toContain('git fetch (cached)');
    expect(fs.statSync(bareRepo).ino).toBe(inodeBefore);
    expect(fs.existsSync(path.join(workCopyOf(action), 'second.txt'))).toBe(true);
  });

  const unreachable = () => ({ url: path.join(testRoot, 'missing.git') });

  it('fails without re-cloning when the remote cannot be reached', async () => {
    await performCachedClone(newPush(), new Step('pullRemote'), { url: remote }, 'basic');
    const inodeBefore = fs.statSync(bareRepo).ino;

    const step = new Step('pullRemote');
    await expect(performCachedClone(newPush(), step, unreachable(), 'basic')).rejects.toThrow(
      /Git fetch failed/,
    );

    expect(step.logs.some((l) => l.includes('rebuilding'))).toBe(false);
    expect(fs.statSync(bareRepo).ino).toBe(inodeBefore);
    expect(stagingLeftovers()).toEqual([]);
  });

  it('rebuilds a corrupted mirror when the fetch fails', async () => {
    await performCachedClone(newPush(), new Step('pullRemote'), { url: remote }, 'basic');
    fs.rmSync(path.join(bareRepo, 'objects'), { recursive: true, force: true });
    fs.writeFileSync(path.join(bareRepo, 'HEAD'), 'garbage');

    const step = new Step('pullRemote');
    const action = newPush();
    await performCachedClone(action, step, { url: remote }, 'basic');

    expect(step.logs.some((l) => l.includes('corrupted bare mirror, rebuilding'))).toBe(true);
    expect(fs.existsSync(path.join(workCopyOf(action), 'first.txt'))).toBe(true);
    expect(stagingLeftovers()).toEqual([]);
  });

  it('leaves a corrupted mirror in place when the rebuild fails too', async () => {
    await performCachedClone(newPush(), new Step('pullRemote'), { url: remote }, 'basic');
    fs.writeFileSync(path.join(bareRepo, 'packed-refs'), 'garbage');
    const inodeBefore = fs.statSync(bareRepo).ino;

    await expect(
      performCachedClone(newPush(), new Step('pullRemote'), unreachable(), 'basic'),
    ).rejects.toThrow(/Git clone failed/);

    expect(fs.statSync(bareRepo).ino).toBe(inodeBefore);
    expect(stagingLeftovers()).toEqual([]);
  });

  it('serialises concurrent pushes to the same repository', async () => {
    const pushes = [newPush(), newPush(), newPush()];

    const results = await Promise.all(
      pushes.map((a) => performCachedClone(a, new Step('pullRemote'), { url: remote }, 'basic')),
    );

    // Exactly one push built the mirror, the others reused it
    expect(results.filter((r) => r.command.includes('clone --bare'))).toHaveLength(1);
    for (const action of pushes) {
      expect(fs.existsSync(path.join(workCopyOf(action), 'first.txt'))).toBe(true);
    }
    expect(fs.readdirSync(cacheDir)).toEqual([path.basename(bareRepo)]);
  });

  it('uses the mocked cache folder', () => {
    expect(cacheManager.getConfig().repoCacheDir).toBe(cacheDir);
  });

  it('fails the push once git exceeds cache.gitTimeoutSeconds, releasing the lock', async () => {
    const getConfig = vi
      .spyOn(cacheManager, 'getConfig')
      .mockReturnValue({ ...cacheManager.getConfig(), gitTimeoutSeconds: 0.001 });

    await expect(
      performCachedClone(newPush(), new Step('pullRemote'), { url: remote }, 'basic'),
    ).rejects.toThrow('git clone timed out after 1ms');

    // The next push to the same repository is not blocked
    getConfig.mockRestore();
    const action = newPush();
    await performCachedClone(action, new Step('pullRemote'), { url: remote }, 'basic');
    expect(fs.existsSync(path.join(workCopyOf(action), 'first.txt'))).toBe(true);
  });

  describe('when a mirror alone exceeds maxSizeGB', () => {
    let originalMax: number;

    beforeEach(() => {
      originalMax = (cacheManager as any).overrides.maxSizeGB;
      (cacheManager as any).overrides.maxSizeGB = 1 / (1024 * 1024 * 1024); // 1 byte
    });

    afterEach(() => {
      (cacheManager as any).overrides.maxSizeGB = originalMax;
    });

    it('keeps the mirror the push just used and warns', async () => {
      const step = new Step('pullRemote');
      await performCachedClone(newPush(), step, { url: remote }, 'basic');

      expect(fs.existsSync(bareRepo)).toBe(true);
      expect(step.logs.some((l) => l.includes('above cache.maxSizeGB'))).toBe(true);

      // ...so the next push is still a cache hit
      const result = await performCachedClone(
        newPush(),
        new Step('pullRemote'),
        { url: remote },
        'basic',
      );
      expect(result.command).toContain('git fetch (cached)');
    });

    it('evicts the older mirror once another repository is pushed', async () => {
      await performCachedClone(newPush(), new Step('pullRemote'), { url: remote }, 'basic');

      const other = actionFor('https://example.com/acme/other.git', `push-${++counter}`);
      other.proxyGitPath = path.join(testRoot, 'work', other.id);
      fs.mkdirSync(other.proxyGitPath, { recursive: true });
      const step = new Step('pullRemote');
      await performCachedClone(other, step, { url: remote }, 'basic');

      expect(fs.existsSync(bareRepo)).toBe(false);
      expect(fs.existsSync(path.join(cacheDir, cacheKeyFor(other)))).toBe(true);
      expect(step.logs.some((l) => l.includes('LRU evicted 1 bare repos'))).toBe(true);
    });
  });

  describe('through pullRemote', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('clones over HTTPS via the cache, and clearBareClone keeps the mirror', async () => {
      vi.spyOn(config, 'isCacheEnabled').mockReturnValue(true);
      // The real access descriptor points at the upstream host; aim it at the local remote
      const prepare = vi
        .spyOn(PullRemoteHTTPSCached.prototype as any, 'prepareRemoteAccess')
        .mockResolvedValue({ url: remote, username: 'user', password: 'pass' });

      const action = actionFor(repoUrl, `exec-${++counter}`);
      const authorization = `Basic ${Buffer.from('user:pass').toString('base64')}`;
      await pullRemote({ headers: { authorization } }, action);

      expect(prepare).toHaveBeenCalledOnce();
      expect(action.pullAuthStrategy).toBe('basic');
      expect(action.steps.at(-1)?.error).toBe(false);
      expect(fs.existsSync(path.join(action.proxyGitPath!, action.repoName, 'first.txt'))).toBe(
        true,
      );

      await clearBareClone(null, action);
      expect(fs.existsSync(action.proxyGitPath!)).toBe(false);
      expect(fs.existsSync(path.join(bareRepo, 'HEAD'))).toBe(true);
    });
  });

  describe('PullRemoteSSHCached', () => {
    const sshClient = { agentForwardingEnabled: true };
    let cleanup: ReturnType<typeof vi.fn>;

    const performClone = (req: any, action: Action) =>
      (new PullRemoteSSHCached() as any).performClone(req, action, new Step('pullRemote'));

    beforeEach(() => {
      cleanup = vi.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const mockAccess = (url: string) =>
      vi
        .spyOn(PullRemoteSSH.prototype as any, 'prepareRemoteAccess')
        .mockResolvedValue({ url, env: { GIT_SSH_COMMAND: 'ssh' }, cleanup });

    it('clones through the cache and cleans up the ssh config', async () => {
      mockAccess(remote);
      const action = newPush();

      const result = await performClone({ sshClient }, action);

      expect(result.strategy).toBe('ssh-agent-forwarding');
      expect(fs.existsSync(path.join(workCopyOf(action), 'first.txt'))).toBe(true);
      expect(cleanup).toHaveBeenCalledOnce();
    });

    it('wraps errors and still cleans up', async () => {
      mockAccess(path.join(testRoot, 'missing.git'));

      await expect(performClone({ sshClient }, newPush())).rejects.toThrow(
        /^SSH clone failed: Git clone failed/,
      );
      expect(cleanup).toHaveBeenCalledOnce();
    });

    it('requires an SSH client with agent forwarding', async () => {
      const prepare = mockAccess(remote);

      await expect(performClone({}, newPush())).rejects.toThrow('No SSH client available');
      await expect(
        performClone({ sshClient: { agentForwardingEnabled: false } }, newPush()),
      ).rejects.toThrow('requires agent forwarding');
      expect(prepare).not.toHaveBeenCalled();
    });
  });
});

describe('createPullRemote', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the uncached implementations when the cache is disabled', () => {
    vi.spyOn(config, 'isCacheEnabled').mockReturnValue(false);
    const action = actionFor('/github.com/finos/git-proxy.git/git-receive-pack');

    const https = createPullRemote({ headers: {} } as any, action);
    expect(https).toBeInstanceOf(PullRemoteHTTPS);
    expect(https).not.toBeInstanceOf(PullRemoteHTTPSCached);

    action.protocol = 'ssh';
    const ssh = createPullRemote(sshReq, action);
    expect(ssh).toBeInstanceOf(PullRemoteSSH);
    expect(ssh).not.toBeInstanceOf(PullRemoteSSHCached);
  });

  it('returns the cached implementations when the cache is enabled', () => {
    vi.spyOn(config, 'isCacheEnabled').mockReturnValue(true);
    const action = actionFor('/github.com/finos/git-proxy.git/git-receive-pack');

    expect(createPullRemote({ headers: {} } as any, action)).toBeInstanceOf(PullRemoteHTTPSCached);

    action.protocol = 'ssh';
    expect(createPullRemote(sshReq, action)).toBeInstanceOf(PullRemoteSSHCached);
  });

  it('still requires agent forwarding for SSH regardless of the cache', () => {
    const action = actionFor('/github.com/finos/git-proxy.git/git-receive-pack');
    action.protocol = 'ssh';

    for (const enabled of [false, true]) {
      vi.spyOn(config, 'isCacheEnabled').mockReturnValue(enabled);
      expect(() => createPullRemote({ sshClient: undefined } as any, action)).toThrow(
        /agent forwarding/,
      );
    }
  });
});
