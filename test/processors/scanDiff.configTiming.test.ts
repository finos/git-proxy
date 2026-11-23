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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Request } from 'express';

import { Action } from '../../src/proxy/actions';

const BLOCKED_LITERAL = 'blocked.example.com';

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

    config.invalidateCache();
    const scanDiff = await import('../../src/proxy/processors/push-action/scanDiff');

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
    fs.writeFileSync(tempUserFile, JSON.stringify(userConfig));
    fileModule.setConfigFile(tempUserFile);
    config.invalidateCache();

    expect(config.getCommitConfig().diff?.block?.literals).toContain(BLOCKED_LITERAL);

    const action = new Action('config-timing-test', 'push', 'POST', Date.now(), 'test/repo.git');
    action.setDiff(diffWithBlockedLiteral);

    const result = await scanDiff.exec({} as Request, action);
    const scanDiffStep = result.steps.find((s) => s.stepName === 'scanDiff');

    expect(scanDiffStep?.error).toBe(true);
    expect(scanDiffStep?.errorMessage).toContain('Your push has been blocked');
    expect(scanDiffStep?.errorMessage).toContain(BLOCKED_LITERAL);
  });
});
