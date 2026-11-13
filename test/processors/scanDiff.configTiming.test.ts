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

// Regression test for the scanDiff config-timing bug.
//
// scanDiff used to read getCommitConfig()/getPrivateOrganizations() at module top
// level, i.e. when the module was first imported. In the real app, index.ts imports
// the proxy (and therefore scanDiff) BEFORE it applies the --config file, so scanDiff
// captured only the empty default block lists and never saw the user's rules.
//
// This test recreates that ordering: scanDiff is imported while the config holds the
// empty defaults, and only afterwards is a config containing a blocked literal loaded.
// A push whose diff contains that literal must then be blocked.
//
// Against the buggy code this fails (scanDiff keeps the stale empty snapshot, so the
// push is not blocked). Against the fixed code it passes, because scanDiff reads the
// config per push.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Request } from 'express';

import { Action } from '../../src/proxy/actions';

const BLOCKED_LITERAL = 'blocked.example.com';

// A minimal diff that adds a single line containing the blocked literal.
const diffWithBlockedLiteral = `diff --git a/test.md b/test.md
new file mode 100644
index 0000000..c41f6f4
--- /dev/null
+++ b/test.md
@@ -0,0 +1 @@
+${BLOCKED_LITERAL}
`;

describe('scanDiff - reads block config applied after import (config timing)', () => {
  let tempDir: string;
  let tempUserFile: string;
  let oldEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    vi.resetModules();
    oldEnv = { ...process.env };
    // CONFIG_FILE would short-circuit the config path resolution and mask the bug,
    // so make sure it is not set for this test.
    delete process.env.CONFIG_FILE;
    tempDir = fs.mkdtempSync('gitproxy-scandiff-timing');
    tempUserFile = path.join(tempDir, 'proxy.config.json');
  });

  afterEach(() => {
    if (fs.existsSync(tempUserFile)) {
      fs.rmSync(tempUserFile);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
    process.env = { ...oldEnv };
    vi.resetModules();
  });

  it('blocks a push containing a literal from config loaded after scanDiff is imported', async () => {
    const fileModule = await import('../../src/config/file');
    const config = await import('../../src/config');

    // 1. Start from the empty default block lists and import scanDiff in that state.
    //    invalidateCache() just empties the in-memory cache; it does not read a file.
    //    The scanDiff import reads no config on the fixed code (nothing runs at module
    //    top level); on the buggy code this import is where scanDiff captures the empty
    //    default config.
    config.invalidateCache();
    const scanDiff = await import('../../src/proxy/processors/push-action/scanDiff');

    // 2. Now load a config whose diff block list contains the literal, exactly as the
    //    real app applies --config after the proxy (and scanDiff) have been imported.
    const userConfig = {
      commitConfig: {
        diff: {
          block: {
            literals: [BLOCKED_LITERAL],
            patterns: [],
            providers: {},
          },
        },
      },
    };
    // writeFileSync writes our file; setConfigFile only points the loader at that path
    // (neither reads it). invalidateCache() forces the NEXT get*() to reload from disk.
    fs.writeFileSync(tempUserFile, JSON.stringify(userConfig));
    fileModule.setConfigFile(tempUserFile);
    config.invalidateCache();

    // Sanity check: this getCommitConfig() is the first read of our temp file from disk,
    // and it really does carry the literal.
    expect(config.getCommitConfig().diff?.block?.literals).toContain(BLOCKED_LITERAL);

    // 3. Run scanDiff over a diff that adds the blocked literal.
    const action = new Action('config-timing-test', 'push', 'POST', Date.now(), 'test/repo.git');
    action.setDiff(diffWithBlockedLiteral);

    const result = await scanDiff.exec({} as Request, action);
    const scanDiffStep = result.steps.find((s) => s.stepName === 'scanDiff');

    // 4. The push must be blocked. Buggy code leaves error false (stale empty config);
    //    fixed code sets error true and reports the detected literal.
    expect(scanDiffStep?.error).toBe(true);
    expect(scanDiffStep?.errorMessage).toContain('Your push has been blocked');
    expect(scanDiffStep?.errorMessage).toContain(BLOCKED_LITERAL);
  });
});
