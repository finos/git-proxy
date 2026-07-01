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

import { describe, it, expect } from 'vitest';
import { changedManifestFiles } from '../../../plugins/git-proxy-plugin-supply-chain/lib/diff.js';
import { classifyManifest } from '../../../plugins/git-proxy-plugin-supply-chain/lib/manifests.js';

const DIFF = `diff --git a/package.json b/package.json
index 1111111..2222222 100644
--- a/package.json
+++ b/package.json
@@ -1,3 +1,4 @@
 {
   "name": "x",
+  "version": "1.0.0",
   "private": true
 }
diff --git a/src/index.js b/src/index.js
index 3333333..4444444 100644
--- a/src/index.js
+++ b/src/index.js
@@ -1 +1 @@
-console.log(1)
+console.log(2)
`;

const DELETION_DIFF = `diff --git a/yarn.lock b/yarn.lock
deleted file mode 100644
index 5555555..0000000
--- a/yarn.lock
+++ /dev/null
@@ -1,2 +0,0 @@
-a
-b
`;

describe('classifyManifest', () => {
  it('classifies npm manifests and lockfiles', () => {
    expect(classifyManifest('package.json')).toEqual({ ecosystem: 'npm', kind: 'manifest' });
    expect(classifyManifest('a/b/package-lock.json')).toEqual({
      ecosystem: 'npm',
      kind: 'lockfile',
    });
    expect(classifyManifest('sub\\dir\\yarn.lock')).toEqual({ ecosystem: 'npm', kind: 'lockfile' });
  });

  it('classifies python manifests and lockfiles (incl. requirements variants)', () => {
    expect(classifyManifest('requirements.txt')).toEqual({ ecosystem: 'python', kind: 'manifest' });
    expect(classifyManifest('requirements-dev.txt')).toEqual({
      ecosystem: 'python',
      kind: 'manifest',
    });
    expect(classifyManifest('svc/pyproject.toml')).toEqual({
      ecosystem: 'python',
      kind: 'manifest',
    });
    expect(classifyManifest('setup.py')).toEqual({ ecosystem: 'python', kind: 'manifest' });
    expect(classifyManifest('poetry.lock')).toEqual({ ecosystem: 'python', kind: 'lockfile' });
    expect(classifyManifest('Pipfile.lock')).toEqual({ ecosystem: 'python', kind: 'lockfile' });
  });

  it('returns null for non-manifest files', () => {
    expect(classifyManifest('src/index.js')).toBeNull();
    expect(classifyManifest('README.md')).toBeNull();
    expect(classifyManifest('')).toBeNull();
  });
});

describe('changedManifestFiles', () => {
  it('returns only recognised manifests from a diff', () => {
    const files = changedManifestFiles(DIFF);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      path: 'package.json',
      ecosystem: 'npm',
      kind: 'manifest',
      deleted: false,
    });
  });

  it('marks deletions and uses the pre-image path', () => {
    const files = changedManifestFiles(DELETION_DIFF);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ path: 'yarn.lock', kind: 'lockfile', deleted: true });
  });

  it('returns [] for empty or non-string input', () => {
    expect(changedManifestFiles('')).toEqual([]);
    // @ts-expect-error deliberately wrong type
    expect(changedManifestFiles(null)).toEqual([]);
  });
});
