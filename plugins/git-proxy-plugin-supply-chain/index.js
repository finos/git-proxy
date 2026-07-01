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
 * GitProxy push plugin that inspects changed dependency manifests/lockfiles for common
 * supply-chain-attack signatures: install lifecycle scripts (postinstall etc.), non-registry
 * dependency sources, typosquatted package names and unpinned versions.
 *
 * It runs with `chainPhase: 'afterDiff'` so the remote has already been cloned and the unified
 * diff computed - letting it read the post-push contents of each changed manifest via git.
 *
 * By default it is non-blocking: findings are attached to the push's review dashboard. Set
 * `failOn` in the config (see lib/config.js) to hard-block pushes at/above a severity.
 */

// Peer dependencies; expected on the Node module path where @finos/git-proxy is installed.
import { PushActionPlugin } from '@finos/git-proxy/plugin';
import { Step } from '@finos/git-proxy/proxy/actions';
import simpleGit from 'simple-git';

import { analyzeChangedFiles } from './lib/analyze.js';
import { loadConfig } from './lib/config.js';
import { changedManifestFiles } from './lib/diff.js';
import { renderFindings } from './lib/findings.js';
import { rankAtLeast } from './lib/severity.js';

const EMPTY_COMMIT_HASH = '0000000000000000000000000000000000000000';

/**
 * Push-chain step: scan changed dependency manifests for supply-chain signatures.
 * @param {import('express').Request} req Express request
 * @param {import('@finos/git-proxy/proxy/actions').Action} action GitProxy action
 * @return {Promise<import('@finos/git-proxy/proxy/actions').Action>} the (possibly annotated/blocked) action
 */
export async function exec(req, action) {
  const step = new Step('supplyChain');

  try {
    const config = loadConfig();
    if (!config.enabled) {
      step.log('supply-chain scanning is disabled');
      return action;
    }

    const diff = action.steps?.find((s) => s.stepName === 'diff')?.content;
    if (!diff || typeof diff !== 'string') {
      step.log('no diff available; skipping supply-chain scan');
      return action;
    }

    const files = changedManifestFiles(diff).filter((f) => config.ecosystems[f.ecosystem]);
    if (files.length === 0) {
      step.log('no dependency manifests changed');
      return action;
    }
    step.log(
      `scanning ${files.length} changed manifest(s): ${files.map((f) => f.path).join(', ')}`,
    );

    const git = simpleGit(`${action.proxyGitPath}/${action.repoName}`);
    const readFile = async (path, rev) => {
      const sha = rev === 'old' ? action.commitFrom : action.commitTo;
      if (!sha || sha === EMPTY_COMMIT_HASH) return null;
      try {
        return await git.show([`${sha}:${path}`]);
      } catch {
        return null; // file absent at that revision (e.g. newly added / deleted)
      }
    };

    const { findings, maxSeverity } = await analyzeChangedFiles({ files, readFile, config });
    if (findings.length === 0) {
      step.log('no supply-chain findings');
      return action;
    }

    const report = renderFindings(findings);
    step.setContent({ findings, maxSeverity });
    step.log(report);

    if (rankAtLeast(maxSeverity, config.failOn)) {
      step.setError(
        `\n\nYour push has been blocked by supply-chain checks ` +
          `(highest severity: ${maxSeverity}).\n\n${report}\n`,
      );
    }
  } catch (e) {
    // The scanner must never break a push on its own errors; surface as a log instead.
    step.log(`supply-chain scan error: ${e?.message ?? e}`);
  } finally {
    action.addStep(step);
  }

  return action;
}

/** GitProxy push plugin wrapper for the supply-chain scanner. */
class SupplyChainPlugin extends PushActionPlugin {
  constructor() {
    super(exec, { chainPhase: 'afterDiff' });
  }
}

export default new SupplyChainPlugin();
