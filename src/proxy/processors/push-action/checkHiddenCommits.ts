/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import path from 'path';
import { Action, Step } from '../../actions';
import { spawnSync } from 'child_process';

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkHiddenCommits');

  try {
    const repoPath = `${action.proxyGitPath}/${action.repoName}`;

    const oldOid = action.commitFrom;
    const newOid = action.commitTo;
    if (!oldOid || !newOid) {
      throw new Error('Both action.commitFrom and action.commitTo must be defined');
    }

    // build introducedCommits set
    const introducedCommits = new Set<string>();
    const revRange =
      oldOid === '0000000000000000000000000000000000000000' ? newOid : `${oldOid}..${newOid}`;
    const revList = spawnSync('git', ['rev-list', revRange], { cwd: repoPath, encoding: 'utf-8' })
      .stdout.trim()
      .split('\n')
      .filter(Boolean);
    revList.forEach((sha) => introducedCommits.add(sha));
    step.log(`Total introduced commits: ${introducedCommits.size}`);

    // build packCommits set
    const packPath = path.join('.git', 'objects', 'pack');
    const packCommits = new Set<string>();
    (action.newIdxFiles || []).forEach((idxFile) => {
      const idxPath = path.join(packPath, idxFile);
      const out = spawnSync('git', ['verify-pack', '-v', idxPath], {
        cwd: repoPath,
        encoding: 'utf-8',
      })
        .stdout.trim()
        .split('\n');
      out.forEach((line) => {
        const [sha, type] = line.split(/\s+/);
        if (type === 'commit') packCommits.add(sha);
      });
    });
    step.log(`Total commits in the pack: ${packCommits.size}`);

    // subset check
    const isSubset = [...packCommits].every((sha) => introducedCommits.has(sha));
    if (!isSubset) {
      // build detailed lists
      const [referenced, unreferenced] = [...packCommits].reduce<[string[], string[]]>(
        ([ref, unref], sha) =>
          introducedCommits.has(sha) ? [[...ref, sha], unref] : [ref, [...unref, sha]],
        [[], []],
      );

      step.log(`Referenced commits: ${referenced.length}`);
      step.log(`Unreferenced commits: ${unreferenced.length}`);

      step.setError(
        `Unreferenced commits in pack (${unreferenced.length}): ${unreferenced.join(', ')}.\n` +
          `This usually happens when a branch was made from a commit that hasn't been approved and pushed to the remote.\n` +
          `Please get approval on the commits, push them and try again.`,
      );
      action.error = true;
      step.setContent(`Referenced: ${referenced.length}, Unreferenced: ${unreferenced.length}`);
    } else {
      // all good, no logging of individual SHAs needed
      step.log('All pack commits are referenced in the introduced range.');
      step.setContent(`All ${packCommits.size} pack commits are within introduced commits.`);
    }
  } catch (e: any) {
    step.setError(e.message);
    throw e;
  } finally {
    action.addStep(step);
  }

  return action;
};

exec.displayName = 'checkHiddenCommits.exec';
export { exec };
