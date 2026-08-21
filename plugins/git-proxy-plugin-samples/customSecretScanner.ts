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
 * This sample plugin scans for secrets in the diff of a git push.
 */

// Peer dependencies; it's expected that these deps exist on Node module path if you've installed @finos/git-proxy
import { PushActionPlugin, PushPhase, PushPluginOptions } from '@finos/git-proxy/plugin';
import { Action, Step } from '@finos/git-proxy/proxy/actions';
import { Request } from 'express';
import parseDiff from 'parse-diff';

const RULES = [
  { name: 'AWS access key', re: /AKIA[0-9A-Z]{16}/g },
  { name: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'Assigned secret', re: /(api[_-]?key|token|password)\s*[:=]\s*['"][^'"]{8,}/gi },
];

class CustomSecretScanner extends PushActionPlugin {
  constructor() {
    super(exec, pluginOptions);
  }
}

const pluginOptions: PushPluginOptions = {
  phase: PushPhase.AFTER_DIFF, // When to execute the plugin within default chain steps
  displayName: 'customSecretScanner.exec', // Display name for the plugin
  isCollectible: true, // If true, the chain will keep running even if plugin returns an error
  chains: ['branch', 'tag'], // Which chains to execute the plugin on
};

async function exec(req: Request, action: Action) {
  const step = new Step('CustomSecretScanner');
  const diff = action.steps.find((s) => s.stepName === 'diff')?.content;

  if (!diff) {
    step.log('no diff available; skipping scan');
    action.addStep(step);
    return action;
  }

  const findings = findSecrets(diff);
  if (findings.length > 0) {
    const report = findings
      .map((f, i) => `${i + 1}. ${f.rule} in ${f.file}:${f.line}`)
      .join('\n');
    step.error = true;
    step.setError(`\n\nPush blocked: possible secrets detected.\n\n${report}\n`);
  }

  action.addStep(step);
  return action;
}

const findSecrets = (diff: string): { rule: string; file?: string; line: number }[] =>
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
            })),
          ),
        ),
    ),
  );

// Default exports are supported and will be loaded by the plugin loader
export default new CustomSecretScanner();
