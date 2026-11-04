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

import { GO_POPULAR } from '../data/go-popular.js';
import { finding } from '../findings.js';
import { SEVERITY } from '../severity.js';
import { levenshtein } from '../typosquat.js';

const GO_SET = new Set(GO_POPULAR.map((n) => n.toLowerCase()));
const GO_RECORDS = GO_POPULAR.map((module) => {
  const [host, ...tailParts] = module.split('/');
  return { module, host, tail: tailParts.join('/') };
});

/**
 * Analyze a changed Go dependency file for supply-chain signatures.
 * @param {{path: string, kind: string, oldContent: ?string, newContent: ?string, config: object}} input file + config
 * @return {import('../findings.js').Finding[]} findings
 */
export function analyzeGo({ path, kind, oldContent, newContent, config }) {
  if (newContent == null) return [];
  const base = path.replace(/\\/g, '/').split('/').pop().toLowerCase();

  if (base === 'go.sum' || kind === 'lockfile') return analyzeGoSum(path, oldContent, newContent);
  if (base === 'go.mod') return analyzeGoMod(path, oldContent, newContent, config);
  return [];
}

/**
 * Collapse whitespace, join arrays for display, and cap length.
 * @param {*|*[]} items value or list of values to truncate
 * @param {number} maxLen max length
 * @return {string} truncated display text
 */
function truncate(items, maxLen) {
  const s = (Array.isArray(items) ? items.join(', ') : String(items)).replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? `${s.slice(0, Math.max(0, maxLen - 3))}...` : s;
}

/**
 * Lines present in the new content but not the old (trimmed, non-empty).
 * @param {?string} oldText previous content
 * @param {string} newText new content
 * @return {string[]} newly added lines
 */
function addedLines(oldText, newText) {
  const oldSet = new Set((oldText || '').split(/\r?\n/).map((l) => l.trim()));
  return newText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !oldSet.has(l));
}

/**
 * @param {string} path go.mod path
 * @param {?string} oldContent previous content
 * @param {string} newContent new content
 * @param {object} config resolved config
 * @return {import('../findings.js').Finding[]} findings
 */
function analyzeGoMod(path, oldContent, newContent, config) {
  const findings = [];
  const prev = parseGoMod(oldContent);
  const next = parseGoMod(newContent);

  const oldRequires = new Set(prev.requires.map(requireKey));
  const oldRequireModules = new Set(prev.requires.map((r) => r.module));
  const oldReplaces = new Set(prev.replaces.map(replaceKey));
  const oldExcludes = new Set(prev.excludes.map(requireKey));
  const suspiciousModules = new Set();
  const newModules = [];
  const newModuleSet = new Set();

  for (const req of next.requires) {
    const isChangedEntry = !oldRequires.has(requireKey(req));
    const isNewModule = !oldRequireModules.has(req.module);

    if (isChangedEntry) {
      addSuspiciousModuleFinding(findings, suspiciousModules, path, req.module);
    }

    if (!isNewModule) continue;
    if (!newModuleSet.has(req.module)) {
      newModuleSet.add(req.module);
      newModules.push(req.module);
    }

    if (/-\d{14}-[0-9a-f]{12}$/i.test(req.version)) {
      findings.push(
        finding({
          severity: SEVERITY.LOW,
          ecosystem: 'go',
          rule: 'go-pseudo-version',
          file: path,
          title: 'Pseudo-version detected',
          detail: `require ${req.module} ${req.version}`,
        }),
      );
    }

    if (/\+incompatible$/i.test(req.version)) {
      findings.push(
        finding({
          severity: SEVERITY.INFO,
          ecosystem: 'go',
          rule: 'go-incompatible-version',
          file: path,
          title: '+incompatible version detected',
          detail: `require ${req.module} ${req.version}`,
        }),
      );
    }

    if (config.typosquat) {
      const near = nearestPopularGo(req.module, config.allowPackages);
      if (near) {
        findings.push(
          finding({
            severity: SEVERITY.HIGH,
            ecosystem: 'go',
            rule: 'typosquat',
            file: path,
            title: `new module "${req.module}" closely resembles the popular module "${near}"`,
            detail: `Consider: ${near}`,
          }),
        );
      }
    }
  }

  for (const replace of next.replaces) {
    if (oldReplaces.has(replaceKey(replace))) continue;

    addSuspiciousModuleFinding(findings, suspiciousModules, path, replace.oldPath);
    if (replace.newVersion && !isLocalPath(replace.newPath)) {
      addSuspiciousModuleFinding(findings, suspiciousModules, path, replace.newPath);
    }

    if (isLocalReplace(replace)) {
      findings.push(
        finding({
          severity: SEVERITY.HIGH,
          ecosystem: 'go',
          rule: 'go-replace-local',
          file: path,
          title: 'Local filesystem replace detected',
          detail: `${formatReplaceSide(replace.oldPath, replace.oldVersion)} -> ${formatReplaceSide(
            replace.newPath,
            replace.newVersion,
          )}`,
        }),
      );
    } else if (replace.newPath !== replace.oldPath) {
      findings.push(
        finding({
          severity: SEVERITY.HIGH,
          ecosystem: 'go',
          rule: 'go-replace-remote',
          file: path,
          title: 'Replace redirects to different module',
          detail: `${formatReplaceSide(replace.oldPath, replace.oldVersion)} -> ${formatReplaceSide(
            replace.newPath,
            replace.newVersion,
          )}`,
        }),
      );
    }
  }

  if (next.toolchain && next.toolchain !== prev.toolchain) {
    const added = !prev.toolchain;
    findings.push(
      finding({
        severity: oldContent == null ? SEVERITY.INFO : SEVERITY.MEDIUM,
        ecosystem: 'go',
        rule: 'go-toolchain',
        file: path,
        title: added ? 'Toolchain added' : 'Toolchain changed',
        detail: added ? `toolchain ${next.toolchain}` : `${prev.toolchain} -> ${next.toolchain}`,
      }),
    );
  }

  for (const exclude of next.excludes) {
    if (oldExcludes.has(requireKey(exclude))) continue;
    findings.push(
      finding({
        severity: SEVERITY.INFO,
        ecosystem: 'go',
        rule: 'go-exclude',
        file: path,
        title: 'Module excluded',
        detail: `exclude ${exclude.module} ${exclude.version}`,
      }),
    );
  }

  if (newModules.length > 0) {
    findings.push(
      finding({
        severity: SEVERITY.INFO,
        ecosystem: 'go',
        rule: 'go-new-modules',
        file: path,
        title: `${newModules.length} new module(s) added`,
        detail: truncate(newModules, 300),
      }),
    );
  }

  return findings;
}

/**
 * @param {string} path go.sum path
 * @param {?string} oldContent previous content
 * @param {string} newContent new content
 * @return {import('../findings.js').Finding[]} findings
 */
function analyzeGoSum(path, oldContent, newContent) {
  const findings = [];

  for (const line of addedLines(oldContent, newContent)) {
    const parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    const module = parts[0];
    const suspicious = suspiciousModule(module);
    if (!suspicious) continue;
    findings.push(
      finding({
        severity: suspicious.severity,
        ecosystem: 'go',
        rule: 'go-sum-suspicious-host',
        file: path,
        title: 'Suspicious module in lockfile',
        detail: `${module}: ${suspicious.why}`,
      }),
    );
  }

  return findings;
}

/**
 * @typedef {{requires: {module: string, version: string}[], replaces: {oldPath: string, oldVersion: ?string, newPath: string, newVersion: ?string}[], excludes: {module: string, version: string}[], toolchain: ?string}} ParsedGoMod
 */

/**
 * Parse go.mod directives with a small state machine.
 * @param {?string} content go.mod text
 * @return {ParsedGoMod} parsed directives
 */
function parseGoMod(content) {
  const parsed = { requires: [], replaces: [], excludes: [], toolchain: null };
  if (content == null) return parsed;

  let state = null;
  for (const raw of String(content).split(/\r?\n/)) {
    const line = raw.split('//')[0].trim();
    if (!line) continue;

    const block = line.match(/^(require|replace|exclude|retract|tool|godebug|ignore)\s*\($/);
    if (block) {
      state = block[1];
      continue;
    }

    if (/^\)$/.test(line)) {
      state = null;
      continue;
    }

    if (state) {
      parseBlockLine(parsed, state, line);
      continue;
    }

    const m = line.match(/^(\S+)(?:\s+(.*))?$/);
    if (!m) continue;
    const directive = m[1];
    const body = m[2] || '';
    if (directive === 'require') addRequire(parsed, body);
    else if (directive === 'replace') addReplace(parsed, body);
    else if (directive === 'exclude') addExclude(parsed, body);
    else if (directive === 'toolchain') {
      const token = body.split(/\s+/)[0];
      if (token) parsed.toolchain = stripModuleToken(token);
    }
  }

  return parsed;
}

/**
 * @param {ParsedGoMod} parsed parsed go.mod
 * @param {string} state current block directive
 * @param {string} line block line
 * @return {void}
 */
function parseBlockLine(parsed, state, line) {
  if (state === 'require') addRequire(parsed, line);
  else if (state === 'replace') addReplace(parsed, line);
  else if (state === 'exclude') addExclude(parsed, line);
}

/**
 * @param {ParsedGoMod} parsed parsed go.mod
 * @param {string} body directive body
 * @return {void}
 */
function addRequire(parsed, body) {
  const entry = parseModuleVersion(body);
  if (!entry.path || !entry.version) return;
  parsed.requires.push({ module: entry.path, version: entry.version });
}

/**
 * @param {ParsedGoMod} parsed parsed go.mod
 * @param {string} body directive body
 * @return {void}
 */
function addExclude(parsed, body) {
  const entry = parseModuleVersion(body);
  if (!entry.path || !entry.version) return;
  parsed.excludes.push({ module: entry.path, version: entry.version });
}

/**
 * @param {ParsedGoMod} parsed parsed go.mod
 * @param {string} body directive body
 * @return {void}
 */
function addReplace(parsed, body) {
  const replace = parseReplace(body);
  if (replace) parsed.replaces.push(replace);
}

/**
 * @param {string} body module path plus optional version
 * @return {{path: string, version: ?string}} parsed side
 */
function parseModuleVersion(body) {
  const parts = String(body || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { path: '', version: null };
  return {
    path: stripModuleToken(parts[0]),
    version: parts[1] ? stripModuleToken(parts[1]) : null,
  };
}

/**
 * @param {string} body replace directive body
 * @return {{oldPath: string, oldVersion: ?string, newPath: string, newVersion: ?string} | null} parsed replace
 */
function parseReplace(body) {
  const sides = String(body || '').split(/\s*=>\s*/);
  if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim()) return null;
  const lhs = parseModuleVersion(sides[0]);
  const rhs = parseModuleVersion(sides[1]);
  if (!lhs.path || !rhs.path) return null;
  return {
    oldPath: lhs.path,
    oldVersion: lhs.version,
    newPath: rhs.path,
    newVersion: rhs.version,
  };
}

/**
 * @param {string} token module token
 * @return {string} token without Go quoting delimiters
 */
function stripModuleToken(token) {
  if (!token || token.length < 2) return token || '';
  const first = token[0];
  const last = token[token.length - 1];
  if ((first === '"' && last === '"') || (first === '`' && last === '`')) {
    return token.slice(1, -1);
  }
  return token;
}

/**
 * @param {{module: string, version: string}} req require or exclude entry
 * @return {string} canonical key
 */
function requireKey(req) {
  return `${req.module}@${req.version}`;
}

/**
 * @param {{oldPath: string, newPath: string, newVersion: ?string}} replace replace entry
 * @return {string} canonical key
 */
function replaceKey(replace) {
  return `${replace.oldPath}=>${replace.newPath}@${replace.newVersion || ''}`;
}

/**
 * @param {string} path module or filesystem path
 * @return {boolean} true when path is local filesystem-like
 */
function isLocalPath(path) {
  return /^(\.{1,2}[\\/]|[\\/]|[A-Za-z]:[\\/])/.test(path);
}

/**
 * @param {{newPath: string, newVersion: ?string}} replace replace entry
 * @return {boolean} true when replace target resolves to local filesystem
 */
function isLocalReplace(replace) {
  return isLocalPath(replace.newPath) || !replace.newVersion;
}

/**
 * @param {string} module module path
 * @param {?string} version optional version
 * @return {string} display text
 */
function formatReplaceSide(module, version) {
  return version ? `${module} ${version}` : module;
}

/**
 * @param {import('../findings.js').Finding[]} findings sink
 * @param {Set<string>} seenModules modules already reported
 * @param {string} path file path
 * @param {string} module module path
 * @return {void}
 */
function addSuspiciousModuleFinding(findings, seenModules, path, module) {
  const key = String(module || '').toLowerCase();
  if (!key || seenModules.has(key)) return;
  const suspicious = suspiciousModule(module);
  if (!suspicious) return;
  seenModules.add(key);
  findings.push(
    finding({
      severity: suspicious.severity,
      ecosystem: 'go',
      rule: 'go-suspicious-host',
      file: path,
      title: 'Suspicious module host',
      detail: `${module}: ${suspicious.why}`,
    }),
  );
}

/**
 * @param {string} module module path
 * @return {{severity: string, why: string} | null} suspicious host classification
 */
function suspiciousModule(module) {
  if (!module || typeof module !== 'string') return null;
  const lower = module.toLowerCase();
  const host = lower.split('/')[0];

  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host)) {
    return { severity: SEVERITY.CRITICAL, why: 'raw IPv4 host' };
  }
  if (/^localhost(?::\d+)?$/.test(host)) {
    return { severity: SEVERITY.HIGH, why: 'localhost host' };
  }
  if (lower.includes('http://')) {
    return { severity: SEVERITY.HIGH, why: 'plain http module path' };
  }
  return null;
}

/**
 * Typosquat check against the popular Go module list.
 * @param {string} name candidate module path
 * @param {string[]} [allow] module paths to never flag
 * @return {string | null} the popular module being impersonated, or null
 */
export function nearestPopularGo(name, allow = []) {
  if (!name || typeof name !== 'string') return null;
  const lower = name.toLowerCase();
  const allowSet = new Set((Array.isArray(allow) ? allow : []).map((n) => String(n).toLowerCase()));
  if (allow.includes(name) || allowSet.has(lower)) return null;

  const normalized = normalizeGoModule(lower);
  if (GO_SET.has(normalized)) return null;

  const [host, ...tailParts] = normalized.split('/');
  const tail = tailParts.join('/');
  if (!host || tail.length < 4) return null;

  for (const pop of GO_RECORDS) {
    if (pop.tail === tail && pop.host !== host && levenshtein(host, pop.host) <= 2) {
      return pop.module;
    }
  }

  const threshold = tail.length >= 6 ? 2 : 1;
  let best = null;
  let bestDist = Infinity;
  for (const pop of GO_RECORDS) {
    if (pop.host !== host) continue;
    const d = levenshtein(tail, pop.tail);
    if (d > 0 && d <= threshold && d < bestDist) {
      best = pop.module;
      bestDist = d;
    }
  }

  return best;
}

/**
 * @param {string} name lowercase Go module path
 * @return {string} normalized path for popular-list comparison
 */
function normalizeGoModule(name) {
  let normalized = String(name || '')
    .trim()
    .replace(/\/v\d+$/, '');
  const [host] = normalized.split('/');
  if (host === 'gopkg.in') normalized = normalized.replace(/\.v\d+$/, '');
  return normalized;
}
