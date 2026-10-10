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

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const packageRoot = dirname(fileURLToPath(import.meta.url));
const outDir = join(packageRoot, 'dist');
const sources = [
  'customSecretScanner.ts',
  'pullScanner/index.ts',
  'pullScanner/parsePull.ts',
  'pullScanner/fetchWanted.ts',
  'pullScanner/resolveWants.ts',
];

for (const source of sources) {
  const sourcePath = join(packageRoot, source);
  const result = ts.transpileModule(readFileSync(sourcePath, 'utf8'), {
    fileName: sourcePath,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      verbatimModuleSyntax: true,
      rewriteRelativeImportExtensions: true,
    },
  });

  if (result.diagnostics?.length) {
    const message = ts.formatDiagnostics(result.diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => packageRoot,
      getNewLine: () => '\n',
    });
    throw new Error(message);
  }

  const outPath = join(outDir, source.replace(/\.ts$/, '.js'));
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, result.outputText);
}
