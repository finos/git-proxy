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
import { analyzeGo } from '../../../plugins/git-proxy-plugin-supply-chain/lib/ecosystems/go.js';
import { resolveConfig } from '../../../plugins/git-proxy-plugin-supply-chain/lib/config.js';

const config = resolveConfig();

const scan = (
  path: string,
  kind: string,
  newContent: string | null,
  oldContent: string | null = null,
) => analyzeGo({ path, kind, oldContent, newContent, config });

const byRule = (findings: { rule: string }[], rule: string) =>
  findings.filter((f) => f.rule === rule);

describe('go analyzer - go.mod replace directives', () => {
  it('flags local filesystem replaces in single-line and block form', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      [
        'module example.com/app',
        'replace github.com/acme/lib => ./local',
        'replace (',
        '  github.com/acme/other => ../other',
        ')',
      ].join('\n'),
    );
    const local = byRule(findings, 'go-replace-local');
    expect(local).toHaveLength(2);
    expect(local.every((f) => f.severity === 'high')).toBe(true);
  });

  it('flags replace directives that redirect to a different remote module', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      'module example.com/app\nreplace github.com/acme/lib => github.com/evil/lib v1.2.3\n',
    );
    const remote = byRule(findings, 'go-replace-remote');
    expect(remote).toHaveLength(1);
    expect(remote[0].severity).toBe('high');
    expect(remote[0].detail).toContain('github.com/evil/lib');
  });

  it('does not flag a same-module version pin as a replace risk', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      'module example.com/app\nreplace github.com/acme/lib v1.0.0 => github.com/acme/lib v1.2.0\n',
    );
    expect(byRule(findings, 'go-replace-local')).toHaveLength(0);
    expect(byRule(findings, 'go-replace-remote')).toHaveLength(0);
  });
});

describe('go analyzer - suspicious hosts and versions', () => {
  it('flags raw-IP require and replace module hosts as CRITICAL', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      [
        'module example.com/app',
        'require 192.0.2.10/acme/lib v1.0.0',
        'replace github.com/acme/lib => 203.0.113.7/acme/lib v1.2.3',
      ].join('\n'),
    );
    const suspicious = byRule(findings, 'go-suspicious-host');
    expect(suspicious).toHaveLength(2);
    expect(suspicious.every((f) => f.severity === 'critical')).toBe(true);
  });

  it('flags localhost require module hosts as HIGH', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      'module example.com/app\nrequire localhost:8080/acme/lib v1.0.0\n',
    );
    const suspicious = byRule(findings, 'go-suspicious-host');
    expect(suspicious).toHaveLength(1);
    expect(suspicious[0].severity).toBe('high');
    expect(suspicious[0].detail).toContain('localhost');
  });

  it('flags a new require with a pseudo-version', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      'module example.com/app\nrequire github.com/acme/lib v0.0.0-20250101123456-abcdef123456\n',
      'module example.com/app\n',
    );
    const pseudo = byRule(findings, 'go-pseudo-version');
    expect(pseudo).toHaveLength(1);
    expect(pseudo[0].severity).toBe('low');
  });

  it('does not flag a version bump to a pseudo-version on an existing module', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      'module example.com/app\nrequire github.com/acme/lib v0.0.0-20250101123456-abcdef123456\n',
      'module example.com/app\nrequire github.com/acme/lib v1.0.0\n',
    );
    expect(byRule(findings, 'go-pseudo-version')).toHaveLength(0);
  });

  it('flags a new require with a +incompatible version', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      'module example.com/app\nrequire github.com/acme/lib v2.0.0+incompatible\n',
    );
    const incompatible = byRule(findings, 'go-incompatible-version');
    expect(incompatible).toHaveLength(1);
    expect(incompatible[0].severity).toBe('info');
  });
});

describe('go analyzer - toolchain, exclude, typosquat, and summaries', () => {
  it('flags a changed toolchain directive as MEDIUM', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      'module example.com/app\ntoolchain go1.23.0\n',
      'module example.com/app\ntoolchain go1.22.0\n',
    );
    const toolchain = byRule(findings, 'go-toolchain');
    expect(toolchain).toHaveLength(1);
    expect(toolchain[0].severity).toBe('medium');
    expect(toolchain[0].title).toContain('changed');
  });

  it('flags a fresh file toolchain directive as INFO', () => {
    const findings = scan('go.mod', 'manifest', 'module example.com/app\ntoolchain go1.23.0\n');
    const toolchain = byRule(findings, 'go-toolchain');
    expect(toolchain).toHaveLength(1);
    expect(toolchain[0].severity).toBe('info');
    expect(toolchain[0].title).toContain('added');
  });

  it('flags an added exclude entry', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      'module example.com/app\nexclude github.com/acme/lib v1.2.0\n',
      'module example.com/app\n',
    );
    const exclude = byRule(findings, 'go-exclude');
    expect(exclude).toHaveLength(1);
    expect(exclude[0].severity).toBe('info');
  });

  it('flags a tail typo against popular Go modules', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      'module example.com/app\nrequire github.com/strechr/testify v1.10.0\n',
    );
    const typo = byRule(findings, 'typosquat');
    expect(typo).toHaveLength(1);
    expect(typo[0].severity).toBe('high');
    expect(typo[0].title).toContain('github.com/stretchr/testify');
  });

  it('flags a host typo against popular Go modules', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      'module example.com/app\nrequire githib.com/stretchr/testify v1.10.0\n',
    );
    const typo = byRule(findings, 'typosquat');
    expect(typo).toHaveLength(1);
    expect(typo[0].title).toContain('github.com/stretchr/testify');
  });

  it('summarizes newly-added require modules', () => {
    const findings = scan(
      'go.mod',
      'manifest',
      'module example.com/app\nrequire github.com/acme/lib v1.0.0\n',
    );
    const summary = byRule(findings, 'go-new-modules');
    expect(summary).toHaveLength(1);
    expect(summary[0].severity).toBe('info');
    expect(summary[0].title).toBe('1 new module(s) added');
    expect(summary[0].detail).toContain('github.com/acme/lib');
  });

  it('returns no findings for unchanged content', () => {
    const content = 'module example.com/app\nrequire github.com/acme/lib v1.0.0\n';
    expect(scan('go.mod', 'manifest', content, content)).toEqual([]);
  });

  it('does not throw on malformed go.mod content', () => {
    expect(() =>
      scan(
        'go.mod',
        'manifest',
        ['\u0000\u0001garbage', 'require (', 'github.com/acme/lib', 'replace github.com/a =>'].join(
          '\n',
        ),
      ),
    ).not.toThrow();
  });
});

describe('go analyzer - go.sum', () => {
  it('flags a newly-added raw-IP module as CRITICAL', () => {
    const findings = scan(
      'go.sum',
      'lockfile',
      'github.com/acme/lib v1.0.0 h1:abc\n192.0.2.10/acme/lib v1.0.0 h1:def\n',
      'github.com/acme/lib v1.0.0 h1:abc\n',
    );
    const suspicious = byRule(findings, 'go-sum-suspicious-host');
    expect(suspicious).toHaveLength(1);
    expect(suspicious[0].severity).toBe('critical');
  });

  it('returns no findings for unchanged or normal go.sum content', () => {
    const content = 'github.com/acme/lib v1.0.0 h1:abc\n';
    expect(scan('go.sum', 'lockfile', content, content)).toEqual([]);
    expect(scan('go.sum', 'lockfile', content)).toEqual([]);
  });
});
