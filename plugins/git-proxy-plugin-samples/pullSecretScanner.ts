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

/**
 * Demonstrates how to scan commits fetched during a git pull operation.
 *
 * Requires the extractPullData sample to run first in order to fetch the wanted commits.
 */

import { PullActionPlugin, PullPhase, type PullPluginOptions } from '@finos/git-proxy/plugin';
import { type Action, Step } from '@finos/git-proxy/proxy/actions';
import { getErrorMessage } from '@finos/git-proxy/utils/errors';
import type { Request } from 'express';
import parseDiff from 'parse-diff';
import { simpleGit } from 'simple-git';

const RULES = [
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'Assigned secret', re: /(api[_-]?key|token|password)\s*[:=]\s*['"][^'"]{8,}/gi },
];

const MAX_REPORTED = 20;
const EMPTY_COMMIT_HASH = '0000000000000000000000000000000000000000';
const EMPTY_TREE = {
  sha1: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
  sha256: '6ef19b41225c5369f1c104d45d8d85efa9b057b53b14b4b9b939dd74decc5321',
} as const;

type Finding = { rule: string; file?: string; line: number; commit: string };

class PullSecretScanner extends PullActionPlugin {
  constructor() {
    super(exec, pluginOptions);
  }
}

const pluginOptions: PullPluginOptions = {
  phase: PullPhase.AFTER_CHECKOUT, // When to execute the plugin within default chain steps
  displayName: 'PullSecretScanner', // Display name for the plugin
  isCollectible: true, // If true, the chain will keep running even if plugin returns an error
};

async function exec(req: Request, action: Action) {
  const step = new Step('PullSecretScanner');
  const pull = action.pullData;
  const wants = pull?.fetchedWants ?? [];

  if (!action.proxyGitPath || wants.length === 0) {
    if (!pull) {
      step.log('no pull data available (is the pullScanner plugin loaded?); skipping scan');
    } else if (pull.repeatedRound) {
      step.log('want-set was already scanned in a recent negotiation round; skipping scan');
    } else {
      step.log(`no commits were fetched for this ${pull.command} request; nothing to scan`);
    }
    action.addStep(step);
    return action;
  }

  try {
    const git = simpleGit(action.proxyGitPath);
    const base = pull?.base && pull.base !== EMPTY_COMMIT_HASH ? pull.base : await emptyTree(git);

    const findings = new Map<string, Finding>();
    for (const want of wants) {
      const diff = await git.raw(['diff', '--no-color', '--no-ext-diff', base, want]);
      for (const finding of findSecrets(diff, want)) {
        const key = `${finding.rule}|${finding.file}|${finding.line}`;
        if (!findings.has(key)) findings.set(key, finding);
      }
    }

    step.log(`scanned ${wants.length} wanted commit(s) against ${base}`);
    if (findings.size > 0) {
      // rejection sent to the client in single pkt-line
      const lines = [...findings.values()]
        .slice(0, MAX_REPORTED)
        .map((f, i) => `${i + 1}. ${f.rule} in ${f.file}:${f.line} (${f.commit.slice(0, 7)})`);
      if (findings.size > MAX_REPORTED) lines.push(`...and ${findings.size - MAX_REPORTED} more`);
      step.setError(`\n\nFetch blocked: possible secrets detected.\n\n${lines.join('\n')}\n`);
    }
  } catch (error: unknown) {
    // fail closed, an unscanned fetch must not be let through
    step.setError(`Unable to scan fetched commits for secrets: ${getErrorMessage(error)}`);
  }

  action.addStep(step);
  return action;
}

const emptyTree = async (git: ReturnType<typeof simpleGit>): Promise<string> => {
  const format = (await git.raw(['rev-parse', '--show-object-format'])).trim();
  return format === 'sha256' ? EMPTY_TREE.sha256 : EMPTY_TREE.sha1;
};

const findSecrets = (diff: string, commit: string): Finding[] =>
  parseDiff(diff).flatMap((file) =>
    file.chunks.flatMap((chunk) =>
      chunk.changes
        .filter((c) => c.type === 'add') // filter for newly added lines
        .flatMap((c) =>
          RULES.flatMap((rule) =>
            [...c.content.matchAll(rule.re)].map(() => ({
              rule: rule.name,
              file: file.to || file.from,
              line: c.ln,
              commit,
            })),
          ),
        ),
    ),
  );

export default new PullSecretScanner();
