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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { Action, RequestType } from '../../src/proxy/actions';
import { SAMPLE_COMMIT } from '../../src/proxy/constants';
import { exec as getDiff } from '../../src/proxy/processors/push-action/getDiff';
import { exec as scanDiff } from '../../src/proxy/processors/push-action/scanDiff';

const { gitDiff } = vi.hoisted(() => ({ gitDiff: vi.fn() }));

vi.mock('simple-git', () => ({ simpleGit: () => ({ diff: gitDiff }) }));
vi.mock('../../src/config', () => ({
  getCommitConfig: () => ({ diff: { block: { literals: ['BLOCKED_MARKER'] } } }),
  getPrivateOrganizations: () => [],
}));

const request = {} as Request;
const makeDiff = (lines: string[]) =>
  `diff --git a/example.txt b/example.txt
--- a/example.txt
+++ b/example.txt
@@ -0,0 +1,${lines.length} @@
${lines.map((line) => `+${line}`).join('\n')}
`;

const makeAction = () => {
  const action = new Action(
    'diff-storage',
    RequestType.PUSH,
    'POST',
    1,
    'https://example.com/org/repo.git',
  );
  action.proxyGitPath = '/unused';
  action.commitFrom = 'a'.repeat(40);
  action.commitTo = 'b'.repeat(40);
  action.commitData = [SAMPLE_COMMIT];
  return action;
};

describe('diff storage and audit logging', () => {
  beforeEach(() => {
    gitDiff.mockReset();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['ordinary', ['reviewable change']],
    ['Unicode', ['Ćorić — 日本語 🚀']],
    ['large', Array.from({ length: 16384 }, () => 'x'.repeat(64))],
  ])('retains a %s diff once for review without logging its contents', async (_name, lines) => {
    const diff = makeDiff(lines as string[]);
    gitDiff.mockResolvedValue(diff);
    const action = await getDiff(request, makeAction());
    await scanDiff(request, action);

    expect(action.error).toBe(false);
    expect(action.steps.find((step) => step.stepName === 'diff')?.content).toBe(diff);
    const encodedDiff = JSON.stringify(diff).slice(1, -1);
    expect(JSON.stringify(action).split(encodedDiff)).toHaveLength(2);
    expect(action.steps.flatMap((step) => step.logs).join('\n')).not.toContain(diff);
    expect(console.info).toHaveBeenCalledWith(
      `diff - Generated diff (${Buffer.byteLength(diff, 'utf8')} bytes)`,
    );
    expect(vi.mocked(console.info).mock.calls.flat().join('\n')).not.toContain(diff);
  });

  it('still rejects prohibited content and records the finding without duplicating the diff', async () => {
    const diff = makeDiff(['ordinary line', 'BLOCKED_MARKER']);
    gitDiff.mockResolvedValue(diff);
    const action = await getDiff(request, makeAction());
    await scanDiff(request, action);

    expect(action.error).toBe(true);
    expect(action.continue()).toBe(false);
    expect(action.errorMessage).toContain('BLOCKED_MARKER');
    expect(action.errorMessage).toContain('example.txt');
    expect(action.steps[0].content).toBe(diff);
    expect(action.steps[1].logs).toContain(
      'scanDiff - Diff is blocked via configured literals/patterns/providers.',
    );
    expect(JSON.stringify(action).split(JSON.stringify(diff).slice(1, -1))).toHaveLength(2);
    expect(vi.mocked(console.info).mock.calls.flat().join('\n')).not.toContain(diff);
  });

  it('preserves a legitimate empty diff and its audit messages', async () => {
    gitDiff.mockResolvedValue('');
    const action = await getDiff(request, makeAction());
    await scanDiff(request, action);

    expect(action.error).toBe(false);
    expect(action.steps[0].content).toBe('');
    expect(action.steps[0].logs).toContain('diff - Generated diff (0 bytes)');
    expect(action.steps[1].logs).toContain(
      'scanDiff - No commit diff found, but this may be legitimate (empty diff).',
    );
  });

  it('records generation errors without claiming to have generated a diff', async () => {
    gitDiff.mockRejectedValue(new Error('Unable to read Git objects'));
    const action = await getDiff(request, makeAction());

    expect(action.error).toBe(true);
    expect(action.continue()).toBe(false);
    expect(action.steps[0].content).toBeNull();
    expect(action.steps[0].logs).toContain('diff - Unable to read Git objects');
    expect(action.steps[0].logs.join('\n')).not.toContain('Generated diff');
  });
});
