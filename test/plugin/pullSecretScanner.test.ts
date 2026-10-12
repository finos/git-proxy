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

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { Request } from 'express';
import { Action, PullType, RequestType, Step } from '../../src/proxy/actions/index.ts';
import { PullData } from '../../src/types/models.ts';
import { PullPhase, isCompatiblePlugin } from '../../src/plugin.ts';
import plugin from '../../plugins/git-proxy-plugin-samples/pullSecretScanner.ts';

const EMPTY_COMMIT_HASH = '0000000000000000000000000000000000000000';

// Built at runtime so the test source itself doesn't trip gitleaks
const AWS_KEY = 'AKIA' + 'A1B2C3D4E5F6G7H8';
const PRIVATE_KEY_HEADER = '-----BEGIN ' + 'RSA PRIVATE KEY-----';
const PRIVATE_KEY_FOOTER = '-----END ' + 'RSA PRIVATE KEY-----';
const ASSIGNED_SECRET = 'api_key = "' + 'x'.repeat(12) + '"';

const GIT_CONFIG = [
  '-c',
  'user.name=test',
  '-c',
  'user.email=test@example.com',
  '-c',
  'commit.gpgsign=false',
  '-c',
  'core.autocrlf=false',
];

const req = { headers: {} } as Request;

let repoDir: string;
let c1: string; // clean files
let c2: string; // adds an AWS key to config.txt:2
let c3: string; // clean follow-up on top of c2
let c4: string; // side branch off c1: private key block + assigned secret

const git = (...args: string[]): string =>
  execFileSync('git', [...GIT_CONFIG, ...args], { cwd: repoDir, encoding: 'utf8' }).trim();

const commit = (message: string): string => {
  git('add', '-A');
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
};

const pullData = (overrides: Partial<PullData> = {}): PullData => ({
  protocolVersion: 2,
  command: PullType.FETCH,
  capabilities: [],
  wants: [],
  haves: [],
  wantRefs: [],
  refPrefixes: [],
  shallow: [],
  done: true,
  options: [],
  ...overrides,
});

const makeAction = (pull: Partial<PullData> | undefined, proxyGitPath: string | undefined) => {
  const action = new Action(
    'action-1',
    RequestType.PULL,
    'POST',
    Date.now(),
    'https://github.com/example/repo.git',
  );
  if (pull) action.pullData = pullData(pull);
  action.proxyGitPath = proxyGitPath;
  return action;
};

const scan = async (pull: Partial<PullData> | undefined, { checkout = true } = {}) => {
  const action = makeAction(pull, checkout ? repoDir : undefined);
  const result = await plugin.exec(req, action);
  const step = result.steps.find((s: Step) => s.stepName === 'PullSecretScanner');
  expect(step).toBeDefined();
  return { result, step: step! };
};

const short = (sha: string) => sha.slice(0, 7);

describe('PullSecretScanner sample plugin', () => {
  beforeAll(() => {
    repoDir = mkdtempSync(join(tmpdir(), 'git-proxy-pull-secret-'));
    git('init', '-q');

    writeFileSync(join(repoDir, 'README.md'), '# example\n');
    writeFileSync(join(repoDir, 'config.txt'), 'region = us-east-1\n');
    c1 = commit('c1: clean');

    writeFileSync(
      join(repoDir, 'config.txt'),
      `region = us-east-1\naws_access_key_id = ${AWS_KEY}\n`,
    );
    c2 = commit('c2: add aws key');

    writeFileSync(join(repoDir, 'NOTES.md'), 'nothing to see here\n');
    c3 = commit('c3: clean follow-up');

    git('checkout', '-q', '-b', 'side', c1);
    mkdirSync(join(repoDir, 'keys'));
    writeFileSync(
      join(repoDir, 'keys', 'id_rsa'),
      `${PRIVATE_KEY_HEADER}\nnot-a-real-key\n${PRIVATE_KEY_FOOTER}\n`,
    );
    writeFileSync(join(repoDir, 'settings.ini'), `[service]\n${ASSIGNED_SECRET}\n`);
    c4 = commit('c4: add private key and assigned secret');
  });

  afterAll(() => {
    if (repoDir) rmSync(repoDir, { recursive: true, force: true });
  });

  describe('diff scan against the client base', () => {
    it('blocks when a wanted commit adds a secret', async () => {
      const { result, step } = await scan({ base: c1, fetchedWants: [c2] });

      expect(step.error).toBe(true);
      expect(result.error).toBe(true);
      expect(step.errorMessage).toContain('Fetch blocked: possible secrets detected');
      expect(step.errorMessage).toContain('AWS access key');
      expect(step.errorMessage).toContain('config.txt:2');
      expect(step.errorMessage).toContain(`(${short(c2)})`);
      expect(step.logs.join('\n')).toContain(`scanned 1 wanted commit(s) against ${c1}`);
    });

    it('only scans lines the client does not already have', async () => {
      // the tree at c3 still contains the key from c2, but the client already has c2
      const { result, step } = await scan({ base: c2, fetchedWants: [c3] });

      expect(step.error).toBe(false);
      expect(step.errorMessage).toBeNull();
      expect(result.error).toBe(false);
      expect(step.logs.join('\n')).toContain(`scanned 1 wanted commit(s) against ${c2}`);
    });
  });

  describe('full-tree scan when the client has no base', () => {
    it.each([
      ['the all-zero hash', EMPTY_COMMIT_HASH],
      ['undefined', undefined],
    ])('blocks a secret in the tree when base is %s', async (_label, base) => {
      const { step } = await scan({ base, fetchedWants: [c2] });

      expect(step.error).toBe(true);
      expect(step.errorMessage).toContain('AWS access key');
      expect(step.errorMessage).toContain('config.txt:2');
      expect(step.errorMessage).toContain(`(${short(c2)})`);
    });

    it.each([
      ['the all-zero hash', EMPTY_COMMIT_HASH],
      ['undefined', undefined],
    ])('allows a clean tree when base is %s', async (_label, base) => {
      const { step } = await scan({ base, fetchedWants: [c1] });

      expect(step.error).toBe(false);
      expect(step.errorMessage).toBeNull();
      expect(step.logs.join('\n')).not.toContain(` against ${EMPTY_COMMIT_HASH}`);
    });
  });

  describe('multiple wants', () => {
    it('reports findings from every wanted commit', async () => {
      const { step } = await scan({ base: c1, fetchedWants: [c2, c4] });

      expect(step.error).toBe(true);
      const message = step.errorMessage!;
      expect(message).toContain(`AWS access key in config.txt:2 (${short(c2)})`);
      expect(message).toContain(`Private key block in keys/id_rsa:1 (${short(c4)})`);
      expect(message).toContain(`Assigned secret in settings.ini:2 (${short(c4)})`);
      expect(message).toMatch(/1\. .*\n2\. .*\n3\. /);
      expect(step.logs.join('\n')).toContain('scanned 2 wanted commit(s)');
    });

    it('reports the same rule/file/line only once', async () => {
      // both c2 and c3 diff against c1 with the AWS key on config.txt:2
      const { step } = await scan({ base: c1, fetchedWants: [c2, c3] });

      expect(step.error).toBe(true);
      const message = step.errorMessage!;
      expect(message.match(/AWS access key in config\.txt:2/g)).toHaveLength(1);
      expect(message).not.toMatch(/\n2\. /);
    });
  });

  describe('skipping without a checkout', () => {
    const PULLSCANNER_HINT = 'no pull data available (is the pullScanner plugin loaded?)';
    const NOTHING_FETCHED = 'no commits were fetched for this fetch request';

    it('skips when proxyGitPath is undefined', async () => {
      const { result, step } = await scan({ base: c1, fetchedWants: [c2] }, { checkout: false });

      expect(step.error).toBe(false);
      expect(result.error).toBe(false);
      expect(step.logs.join('\n')).toContain(NOTHING_FETCHED);
    });

    it('skips when fetchedWants is empty', async () => {
      const { step } = await scan({ base: c1, fetchedWants: [] });

      expect(step.error).toBe(false);
      expect(step.logs.join('\n')).toContain(NOTHING_FETCHED);
    });

    it('skips when there is no pullData at all', async () => {
      const { step } = await scan(undefined);

      expect(step.error).toBe(false);
      expect(step.logs.join('\n')).toContain(PULLSCANNER_HINT);
    });

    it('logs the negotiation-round message on a repeated round', async () => {
      const { step } = await scan({ repeatedRound: true }, { checkout: false });

      expect(step.error).toBe(false);
      expect(step.logs.join('\n')).toContain(
        'want-set was already scanned in a recent negotiation round; skipping scan',
      );
      expect(step.logs.join('\n')).not.toContain('pullScanner');
    });
  });

  describe('failing closed', () => {
    it('errors when a wanted commit is missing from the checkout', async () => {
      const { result, step } = await scan({ base: c1, fetchedWants: ['f'.repeat(40)] });

      expect(step.error).toBe(true);
      expect(result.error).toBe(true);
      expect(step.errorMessage).toContain('Unable to scan fetched commits for secrets');
    });

    it('errors when the base commit is missing from the checkout', async () => {
      const { step } = await scan({ base: 'e'.repeat(40), fetchedWants: [c2] });

      expect(step.error).toBe(true);
      expect(step.errorMessage).toContain('Unable to scan fetched commits for secrets');
    });
  });

  describe('plugin metadata', () => {
    it('is a collectible pull plugin running after checkout', () => {
      expect(plugin.phase).toBe(PullPhase.AFTER_CHECKOUT);
      expect(plugin.phase).toBe('AFTER_CHECKOUT');
      expect(plugin.displayName).toBe('PullSecretScanner');
      expect(plugin.isCollectible).toBe(true);
      expect(isCompatiblePlugin(plugin, 'isGitProxyPullActionPlugin')).toBe(true);
      expect(isCompatiblePlugin(plugin, 'isGitProxyPushActionPlugin')).toBe(false);
    });
  });
});
