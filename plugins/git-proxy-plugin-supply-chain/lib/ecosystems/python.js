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

import { finding } from '../findings.js';
import { SEVERITY } from '../severity.js';
import { nearestPopularPython } from '../typosquat.js';

// Patterns that indicate install/build-time code execution or obfuscation in setup.py.
// Ordered most-specific -> least; the first match supplies the "why".
const DANGEROUS_PY_PATTERNS = [
  {
    re: /\b(?:os\.system|subprocess\.\w+|os\.popen|pty\.spawn)\s*\(/i,
    why: 'executes shell/subprocess commands',
  },
  { re: /(?:https?:\/\/)?\b\d{1,3}(?:\.\d{1,3}){3}\b/, why: 'references a raw IP address' },
  {
    re: /base64\.(?:b64decode|decodebytes|b85decode)|codecs\.decode/i,
    why: 'decodes base64/obfuscated data',
  },
  { re: /\b(?:eval|exec|compile)\s*\(/, why: 'uses eval()/exec()/compile()' },
  { re: /\b__import__\s*\(/, why: 'performs a dynamic __import__()' },
  {
    re: /\b(?:urllib|urlopen|requests\.(?:get|post)|httpx\.|socket\.socket|urlretrieve)\b/i,
    why: 'performs network access at install/build time',
  },
];

const DEFAULT_INDEX_HOSTS = ['pypi.org', 'files.pythonhosted.org', 'pypi.python.org'];

/**
 * Analyze a changed Python dependency file for supply-chain signatures.
 * @param {{path: string, kind: string, oldContent: ?string, newContent: ?string, config: object}} input file + config
 * @return {import('../findings.js').Finding[]} findings
 */
export function analyzePython({ path, kind, oldContent, newContent, config }) {
  if (newContent == null) return [];
  const base = path.replace(/\\/g, '/').split('/').pop().toLowerCase();

  if (base === 'setup.py') return analyzeSetupPy(path, oldContent, newContent);
  if (/^requirements[\w.-]*\.txt$/.test(base)) {
    return analyzeRequirements(path, oldContent, newContent, config);
  }
  if (base === 'pyproject.toml' || base === 'pipfile' || base === 'setup.cfg') {
    return analyzeTomlLike(path, oldContent, newContent, config);
  }
  if (kind === 'lockfile') return analyzePythonLockfile(path, oldContent, newContent, config);
  return [];
}

/**
 * Detect the first dangerous pattern in Python source.
 * @param {string} text source text
 * @return {?string} reason, or null
 */
function detectDangerousPy(text) {
  for (const p of DANGEROUS_PY_PATTERNS) {
    if (p.re.test(text)) return p.why;
  }
  return null;
}

/**
 * Collapse whitespace and cap length for display in findings.
 * @param {*} str value to truncate
 * @param {number} [n] max length
 * @return {string} truncated string
 */
function truncate(str, n = 160) {
  const s = String(str).replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * Lines present in the new content but not the old (trimmed, non-empty). Limits scanning to
 * content actually introduced by this push, reducing noise on large unchanged files.
 * @param {?string} oldContent previous content
 * @param {string} newContent new content
 * @return {string[]} newly added lines
 */
function addedLines(oldContent, newContent) {
  const oldSet = new Set((oldContent || '').split(/\r?\n/).map((l) => l.trim()));
  return newContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !oldSet.has(l));
}

/**
 * @param {string} path setup.py path
 * @param {?string} oldContent previous content
 * @param {string} newContent new content
 * @return {import('../findings.js').Finding[]} findings
 */
function analyzeSetupPy(path, oldContent, newContent) {
  // setup.py runs arbitrary Python at install/build time - always worth surfacing when touched.
  const scanTarget =
    oldContent == null ? newContent : addedLines(oldContent, newContent).join('\n');
  const danger = detectDangerousPy(scanTarget);
  const verb = oldContent == null ? 'added' : 'modified';
  return [
    finding({
      severity: danger ? SEVERITY.CRITICAL : SEVERITY.HIGH,
      ecosystem: 'python',
      rule: 'python-setup-script',
      file: path,
      title: `setup.py ${verb} (runs arbitrary code at install/build time)`,
      detail: danger ? danger : 'review setup.py for install-time code execution',
    }),
  ];
}

/**
 * Strip an inline/`# ...` comment while preserving URL fragments like `...#egg=name`.
 * @param {string} raw a requirements line
 * @return {string} the line without its trailing comment
 */
function stripReqComment(raw) {
  // A pip comment is a `#` preceded by whitespace (or the start of line).
  return raw.split(/\s+#/)[0];
}

/**
 * @param {string} path requirements file path
 * @param {?string} oldContent previous content
 * @param {string} newContent new content
 * @param {object} config resolved config
 * @return {import('../findings.js').Finding[]} findings
 */
function analyzeRequirements(path, oldContent, newContent, config) {
  const findings = [];
  for (const raw of addedLines(oldContent, newContent)) {
    const line = stripReqComment(raw).trim();
    if (!line || line.startsWith('#')) continue;

    const indexMatch = line.match(/^(--index-url|--extra-index-url|-i)\b/i);
    if (indexMatch) {
      const isExtra = /extra-index-url/i.test(indexMatch[1]);
      findings.push(
        finding({
          severity: isExtra ? SEVERITY.HIGH : SEVERITY.MEDIUM,
          ecosystem: 'python',
          rule: 'python-index-url',
          file: path,
          title: `requirements sets a custom package index (${indexMatch[1]}) - dependency-confusion risk`,
          detail: truncate(line),
        }),
      );
      continue;
    }

    const isVcsOrUrl =
      /^(-e|--editable)\b/i.test(line) ||
      /^(git\+|hg\+|svn\+|bzr\+|https?:\/\/|file:)/i.test(line) ||
      /\s@\s+(git\+|https?:\/\/|file:)/i.test(line);
    if (isVcsOrUrl) {
      findings.push(
        finding({
          severity: SEVERITY.HIGH,
          ecosystem: 'python',
          rule: 'python-non-registry-source',
          file: path,
          title: 'requirement installed from a non-registry source (vcs/url/editable)',
          detail: truncate(line),
        }),
      );
      continue;
    }

    if (line.startsWith('-')) continue; // other pip options (e.g. -r, --hash)

    const nameMatch = line.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const rest = line
      .slice(name.length)
      .replace(/\[[^\]]*\]/, '')
      .trim();
    if (!/[=<>~!@]/.test(rest)) {
      findings.push(
        finding({
          severity: SEVERITY.LOW,
          ecosystem: 'python',
          rule: 'python-unpinned',
          file: path,
          title: `requirement "${name}" is unpinned`,
          detail: truncate(line, 120),
        }),
      );
    }
    if (config.typosquat) {
      const near = nearestPopularPython(name, config.allowPackages);
      if (near) {
        findings.push(
          finding({
            severity: SEVERITY.HIGH,
            ecosystem: 'python',
            rule: 'typosquat',
            file: path,
            title: `requirement "${name}" closely resembles the popular package "${near}"`,
            detail: `possible typosquat; verify "${name}" is the intended package`,
          }),
        );
      }
    }
  }
  return findings;
}

/**
 * Scan pyproject.toml / Pipfile / setup.cfg added lines for non-registry sources and custom
 * package indexes (text scan - no TOML parser dependency).
 * @param {string} path file path
 * @param {?string} oldContent previous content
 * @param {string} newContent new content
 * @param {object} config resolved config
 * @return {import('../findings.js').Finding[]} findings
 */
function analyzeTomlLike(path, oldContent, newContent, config) {
  const findings = [];
  const indexHosts = Array.isArray(config.pythonIndexHosts)
    ? config.pythonIndexHosts
    : DEFAULT_INDEX_HOSTS;

  for (const line of addedLines(oldContent, newContent)) {
    // Custom package index declaration (poetry: [[tool.poetry.source]]; pipenv: [[source]]).
    if (/^\[\[\s*(?:tool\.poetry\.)?source\s*\]\]/i.test(line)) {
      findings.push(
        finding({
          severity: SEVERITY.MEDIUM,
          ecosystem: 'python',
          rule: 'python-custom-index',
          file: path,
          title: 'declares a custom package index source - dependency-confusion risk',
          detail: truncate(line),
        }),
      );
      continue;
    }

    // Inline table dependency sources: `foo = { git = "..." }` / `{ url = "..." }` / `{ path = "..." }`.
    const inline = line.match(/\b(git|url|path)\s*=\s*["']([^"']+)["']/i);
    if (inline) {
      const kind = inline[1].toLowerCase();
      const value = inline[2];
      // A registry index `url` pointing at the official host is not a non-registry source.
      let host = null;
      try {
        host = new URL(value).host.toLowerCase();
      } catch {
        host = null;
      }
      const isOfficialIndex =
        kind === 'url' && host && indexHosts.some((h) => host === h || host.endsWith(`.${h}`));
      if (!isOfficialIndex) {
        findings.push(
          finding({
            severity: SEVERITY.HIGH,
            ecosystem: 'python',
            rule: 'python-non-registry-source',
            file: path,
            title: `dependency pinned to a non-registry source (${kind})`,
            detail: truncate(line),
          }),
        );
      }
      continue;
    }

    // PEP 508 direct URL reference: `name @ https://...` or `name @ git+...`.
    if (/["']?[A-Za-z0-9._-]+\s+@\s+(git\+|https?:\/\/|file:)/.test(line)) {
      findings.push(
        finding({
          severity: SEVERITY.HIGH,
          ecosystem: 'python',
          rule: 'python-non-registry-source',
          file: path,
          title: 'dependency uses a PEP 508 direct URL reference',
          detail: truncate(line),
        }),
      );
    }
  }
  return findings;
}

/**
 * Scan poetry.lock / Pipfile.lock added lines for newly-introduced git/url package sources.
 * @param {string} path lockfile path
 * @param {?string} oldContent previous content
 * @param {string} newContent new content
 * @param {object} config resolved config
 * @return {import('../findings.js').Finding[]} findings
 */
function analyzePythonLockfile(path, oldContent, newContent, config) {
  const findings = [];
  const indexHosts = Array.isArray(config.pythonIndexHosts)
    ? config.pythonIndexHosts
    : DEFAULT_INDEX_HOSTS;
  const urlRe = /(git\+[^\s"',}\]]+|https?:\/\/[^\s"',}\]]+)/gi;

  for (const line of addedLines(oldContent, newContent)) {
    // A git package source can be declared either by a `git+` URL or by a git key/type next to
    // a plain URL (e.g. Pipfile.lock `"git": "https://..."`, poetry `type = "git"`).
    const gitContext = /(?:^|[\s"'{,])(?:git|type)\s*[:=]\s*["']?git\b/i.test(line);

    let m;
    urlRe.lastIndex = 0;
    while ((m = urlRe.exec(line)) !== null) {
      const url = m[1];
      if (/^git\+/i.test(url) || gitContext) {
        findings.push(
          finding({
            severity: SEVERITY.HIGH,
            ecosystem: 'python',
            rule: 'python-lockfile-git-source',
            file: path,
            title: 'lockfile resolves a package from a git source',
            detail: truncate(url),
          }),
        );
        continue;
      }
      if (/^http:\/\//i.test(url)) {
        findings.push(
          finding({
            severity: SEVERITY.HIGH,
            ecosystem: 'python',
            rule: 'python-lockfile-insecure-source',
            file: path,
            title: 'lockfile resolves a package over plain http',
            detail: truncate(url),
          }),
        );
        continue;
      }
      let host = null;
      try {
        host = new URL(url).host.toLowerCase();
      } catch {
        host = null;
      }
      const offIndex = host && !indexHosts.some((h) => host === h || host.endsWith(`.${h}`));
      if (offIndex) {
        findings.push(
          finding({
            severity: SEVERITY.MEDIUM,
            ecosystem: 'python',
            rule: 'python-lockfile-offindex-source',
            file: path,
            title: `lockfile resolves a package from an unexpected index (${host})`,
            detail: truncate(url),
          }),
        );
      }
    }
  }
  return findings;
}
