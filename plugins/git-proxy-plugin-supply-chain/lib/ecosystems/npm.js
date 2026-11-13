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
import { nearestPopular } from '../typosquat.js';

// Scripts that npm executes automatically during `npm install` - the primary code-execution
// vector for supply-chain attacks.
const INSTALL_HOOKS = ['preinstall', 'install', 'postinstall', 'prepare'];
// Other lifecycle scripts that run arbitrary code but not during a plain `npm install`.
const OTHER_LIFECYCLE = [
  'preuninstall',
  'postuninstall',
  'prepublish',
  'prepublishonly',
  'prepack',
  'postpack',
];
const LIFECYCLE = new Set([...INSTALL_HOOKS, ...OTHER_LIFECYCLE]);

const DEP_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

// Ordered most-specific -> least; the first matching pattern supplies the "why".
const DANGEROUS_SCRIPT_PATTERNS = [
  {
    re: /(?:curl|wget|fetch)\b[^\n]*?\|\s*(?:sh|bash|zsh|node|python[0-9.]*)\b/i,
    why: 'pipes a downloaded payload straight into a shell/interpreter',
  },
  { re: /(?:https?:\/\/)?\b\d{1,3}(?:\.\d{1,3}){3}\b/, why: 'references a raw IP address' },
  { re: /\bbase64\b[^\n]*?(?:-d|--decode)\b/i, why: 'decodes base64 (possible obfuscation)' },
  { re: /\beval\s*\(/i, why: 'calls eval()' },
  { re: /\bnode\s+(?:-e|--eval)\b/i, why: 'executes inline code via node -e/--eval' },
  { re: /child_process/i, why: 'spawns child processes' },
  { re: /(?:\bcurl\b|\bwget\b|https?:\/\/)/i, why: 'performs network access during install' },
];

/**
 * Analyze a changed npm file for supply-chain signatures.
 * @param {{path: string, kind: string, oldContent: ?string, newContent: ?string, config: object}} input file + config
 * @return {import('../findings.js').Finding[]} findings
 */
export function analyzeNpm(input) {
  if (input.kind === 'lockfile') return analyzeNpmLockfile(input);
  return analyzeNpmManifest(input);
}

/**
 * Detect the first dangerous pattern in a script string.
 * @param {string} script script command
 * @return {?string} reason, or null
 */
function detectDangerous(script) {
  for (const p of DANGEROUS_SCRIPT_PATTERNS) {
    if (p.re.test(script)) return p.why;
  }
  return null;
}

/**
 * Collapse whitespace and cap length for display in findings.
 * @param {*} str value to truncate
 * @param {number} [n] max length
 * @return {string} truncated string
 */
function truncate(str, n = 200) {
  const s = String(str).replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/**
 * Parse JSON, distinguishing "absent" (undefined) from "present but invalid" (null).
 * @param {?string} content file content
 * @return {*} parsed value, null when invalid, undefined when absent
 */
function parseJson(content) {
  if (content == null) return undefined;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Classify a package.json dependency version spec by its source.
 * @param {*} spec version spec
 * @return {{type: 'registry'|'git'|'url'|'file'|'alias'|'workspace'}} classification
 */
function classifySpec(spec) {
  if (typeof spec !== 'string') return { type: 'registry' };
  const s = spec.trim();
  if (/^(git\+|git:|github:|gitlab:|bitbucket:|gist:)/i.test(s)) return { type: 'git' };
  if (/^ssh:\/\//i.test(s)) return { type: 'git' };
  // scp-like SSH shorthand npm resolves via hosted-git-info, e.g. git@github.com:owner/repo.git
  if (/^[\w.+-]+@[\w.-]+:[^\s]/.test(s)) return { type: 'git' };
  if (/^https?:\/\//i.test(s)) return { type: 'url' };
  if (/^(file:|link:|portal:)/i.test(s)) return { type: 'file' };
  if (/^(\.{1,2}\/|\/)/.test(s)) return { type: 'file' }; // local path
  if (/^npm:/i.test(s)) return { type: 'alias' };
  if (/^workspace:/i.test(s)) return { type: 'workspace' };
  // GitHub shorthand: "user/repo" or "user/repo#ref" (but not a semver range).
  if (/^[\w.-]+\/[\w.-]+(#.+)?$/.test(s) && !/^[\d^~<>=]/.test(s)) return { type: 'git' };
  return { type: 'registry' };
}

const LOOSE_SPECS = new Set(['*', '', 'x', 'latest']);

/**
 * Whether a version spec is effectively unpinned (accepts arbitrary future versions).
 * @param {*} spec version spec
 * @return {boolean} true when loose/wildcard
 */
function isLooseSpec(spec) {
  if (typeof spec !== 'string') return false;
  const s = spec.trim().toLowerCase();
  return LOOSE_SPECS.has(s) || /^>=?\s*0(?:\.0)*$/.test(s);
}

/**
 * @param {object} obj possibly-undefined object
 * @return {boolean} true when a plain object
 */
function isObject(obj) {
  return !!obj && typeof obj === 'object' && !Array.isArray(obj);
}

/**
 * @param {{path: string, oldContent: ?string, newContent: ?string, config: object}} input manifest input
 * @return {import('../findings.js').Finding[]} findings
 */
function analyzeNpmManifest({ path, oldContent, newContent, config }) {
  const findings = [];

  const next = parseJson(newContent);
  if (next === null) {
    findings.push(
      finding({
        severity: SEVERITY.LOW,
        ecosystem: 'npm',
        rule: 'unparseable-manifest',
        file: path,
        title: 'package.json could not be parsed as JSON',
      }),
    );
    return findings;
  }
  if (!isObject(next)) return findings;

  const parsedPrev = parseJson(oldContent);
  const prev = isObject(parsedPrev) ? parsedPrev : {};

  analyzeScripts(
    findings,
    path,
    isObject(prev.scripts) ? prev.scripts : {},
    isObject(next.scripts) ? next.scripts : {},
  );
  analyzeDependencies(findings, path, prev, next, config);
  analyzeOverrides(findings, path, prev, next);
  return findings;
}

// Manifest fields that can force a (possibly transitive) dependency to a specific source:
// yarn `resolutions`, npm/pnpm `overrides`, and pnpm's `pnpm.overrides`.
const OVERRIDE_ROOTS = [
  { label: 'resolutions', get: (pkg) => pkg.resolutions },
  { label: 'overrides', get: (pkg) => pkg.overrides },
  { label: 'pnpm.overrides', get: (pkg) => (isObject(pkg.pnpm) ? pkg.pnpm.overrides : undefined) },
];

/**
 * Flatten an overrides/resolutions tree into `{ keyPath: spec }` string leaves. npm `overrides`
 * values may be nested objects (with '.' meaning the package's own version), so this recurses.
 * @param {*} obj overrides subtree
 * @param {string} prefix accumulated key path
 * @param {Object<string,string>} out sink
 * @return {Object<string,string>} flattened spec map
 */
function collectOverrideSpecs(obj, prefix, out) {
  if (!isObject(obj)) return out;
  for (const [key, value] of Object.entries(obj)) {
    const keyPath = prefix ? `${prefix}/${key}` : key;
    if (typeof value === 'string') {
      out[keyPath] = value;
    } else if (isObject(value)) {
      collectOverrideSpecs(value, keyPath, out);
    }
  }
  return out;
}

/**
 * Flag added/changed override/resolution entries that force a non-registry source.
 * @param {import('../findings.js').Finding[]} findings sink
 * @param {string} path manifest path
 * @param {object} prev previous package.json
 * @param {object} next new package.json
 * @return {void}
 */
function analyzeOverrides(findings, path, prev, next) {
  for (const { label, get } of OVERRIDE_ROOTS) {
    const nextMap = collectOverrideSpecs(get(next), '', {});
    const prevMap = collectOverrideSpecs(get(prev), '', {});
    for (const [key, spec] of Object.entries(nextMap)) {
      if (prevMap[key] === spec) continue; // unchanged

      const { type } = classifySpec(spec);
      if (type === 'git' || type === 'url' || type === 'file') {
        findings.push(
          finding({
            severity: SEVERITY.HIGH,
            ecosystem: 'npm',
            rule: 'override-source',
            file: path,
            title: `${label} entry "${key}" forces a non-registry source (${type})`,
            detail: `${label}: ${key} -> ${truncate(spec, 120)}`,
          }),
        );
      }
    }
  }
}

/**
 * Flag added/modified lifecycle scripts and dangerous script content.
 * @param {import('../findings.js').Finding[]} findings sink
 * @param {string} path manifest path
 * @param {Object<string,string>} prevScripts previous scripts map
 * @param {Object<string,string>} nextScripts new scripts map
 * @return {void}
 */
function analyzeScripts(findings, path, prevScripts, nextScripts) {
  for (const [name, script] of Object.entries(nextScripts)) {
    if (typeof script !== 'string') continue;
    if (!LIFECYCLE.has(name.toLowerCase())) continue;

    const isHook = INSTALL_HOOKS.includes(name.toLowerCase());
    const existed = Object.prototype.hasOwnProperty.call(prevScripts, name);
    const changed = prevScripts[name] !== script;
    const danger = detectDangerous(script);

    let severity;
    let title;
    if (changed) {
      severity = danger ? SEVERITY.CRITICAL : isHook ? SEVERITY.HIGH : SEVERITY.MEDIUM;
      title = `install lifecycle script "${name}" ${existed ? 'modified' : 'added'}`;
    } else if (danger) {
      // Pre-existing but dangerous - still worth surfacing to the reviewer.
      severity = isHook ? SEVERITY.HIGH : SEVERITY.MEDIUM;
      title = `existing lifecycle script "${name}" runs a suspicious command`;
    } else {
      continue; // unchanged, benign lifecycle script -> skip to reduce noise
    }

    const detail = danger ? `${danger}: \`${truncate(script)}\`` : `\`${truncate(script)}\``;
    findings.push(
      finding({ severity, ecosystem: 'npm', rule: 'install-script', file: path, title, detail }),
    );
  }
}

/**
 * Flag suspicious dependency sources, unpinned versions, typosquats and list new dependencies.
 * @param {import('../findings.js').Finding[]} findings sink
 * @param {string} path manifest path
 * @param {object} prev previous package.json
 * @param {object} next new package.json
 * @param {object} config resolved plugin config
 * @return {void}
 */
function analyzeDependencies(findings, path, prev, next, config) {
  const newlyAdded = [];

  for (const field of DEP_FIELDS) {
    const nextDeps = isObject(next[field]) ? next[field] : {};
    const prevDeps = isObject(prev[field]) ? prev[field] : {};

    for (const [name, spec] of Object.entries(nextDeps)) {
      const isNew = !Object.prototype.hasOwnProperty.call(prevDeps, name);
      const changed = prevDeps[name] !== spec;
      if (!isNew && !changed) continue; // untouched dependency

      const { type } = classifySpec(spec);
      if (type === 'git' || type === 'url' || type === 'file') {
        findings.push(
          finding({
            severity: isNew ? SEVERITY.HIGH : SEVERITY.MEDIUM,
            ecosystem: 'npm',
            rule: 'non-registry-source',
            file: path,
            title: `dependency "${name}" resolves from a non-registry source (${type})`,
            detail: `${field}: ${name} -> ${truncate(spec, 120)}`,
          }),
        );
      } else if (type === 'alias') {
        findings.push(
          finding({
            severity: SEVERITY.MEDIUM,
            ecosystem: 'npm',
            rule: 'npm-alias',
            file: path,
            title: `dependency "${name}" is installed under an npm alias`,
            detail: `${field}: ${name} -> ${truncate(spec, 120)}`,
          }),
        );
      }

      if (isLooseSpec(spec)) {
        findings.push(
          finding({
            severity: SEVERITY.MEDIUM,
            ecosystem: 'npm',
            rule: 'loose-version',
            file: path,
            title: `dependency "${name}" uses an unpinned/wildcard version`,
            detail: `${field}: ${name} -> "${spec}"`,
          }),
        );
      }

      if (isNew) {
        newlyAdded.push(`${name} (${field})`);
        if (config.typosquat) {
          const near = nearestPopular(name, config.allowPackages);
          if (near) {
            findings.push(
              finding({
                severity: SEVERITY.HIGH,
                ecosystem: 'npm',
                rule: 'typosquat',
                file: path,
                title: `new dependency "${name}" closely resembles the popular package "${near}"`,
                detail: `possible typosquat; verify "${name}" is the intended package`,
              }),
            );
          }
        }
      }
    }
  }

  if (newlyAdded.length > 0) {
    findings.push(
      finding({
        severity: SEVERITY.INFO,
        ecosystem: 'npm',
        rule: 'new-dependencies',
        file: path,
        title: `${newlyAdded.length} new dependency(ies) added`,
        detail: truncate(newlyAdded.join(', '), 300),
      }),
    );
  }
}

const DEFAULT_REGISTRY_HOST = 'registry.npmjs.org';

/**
 * Scan a lockfile for newly-introduced package sources that don't resolve to the expected
 * registry (git sources, plain-http tarballs, or off-registry hosts).
 * @param {{path: string, oldContent: ?string, newContent: ?string, config: object}} input lockfile input
 * @return {import('../findings.js').Finding[]} findings
 */
function analyzeNpmLockfile({ path, oldContent, newContent, config }) {
  const findings = [];
  if (newContent == null) return findings;

  const allowedHosts =
    Array.isArray(config.npmRegistryHosts) && config.npmRegistryHosts.length
      ? config.npmRegistryHosts
      : [DEFAULT_REGISTRY_HOST];

  const newUrls = extractResolvedUrls(newContent);
  const oldUrls = oldContent ? extractResolvedUrls(oldContent) : new Set();

  for (const url of newUrls) {
    if (oldUrls.has(url)) continue; // pre-existing source

    const isGit = /^git\+/i.test(url) || /\.git(?:$|#)/i.test(url);
    const isHttp = /^http:\/\//i.test(url);
    let host = null;
    try {
      host = new URL(url).host;
    } catch {
      host = null;
    }
    const offRegistry = host && !allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));

    if (isGit) {
      findings.push(
        finding({
          severity: SEVERITY.HIGH,
          ecosystem: 'npm',
          rule: 'lockfile-git-source',
          file: path,
          title: 'lockfile resolves a package from a git source',
          detail: truncate(url, 160),
        }),
      );
    } else if (isHttp) {
      findings.push(
        finding({
          severity: SEVERITY.HIGH,
          ecosystem: 'npm',
          rule: 'lockfile-insecure-source',
          file: path,
          title: 'lockfile resolves a package over plain http',
          detail: truncate(url, 160),
        }),
      );
    } else if (offRegistry) {
      findings.push(
        finding({
          severity: SEVERITY.MEDIUM,
          ecosystem: 'npm',
          rule: 'lockfile-offregistry-source',
          file: path,
          title: `lockfile resolves a package from an unexpected registry (${host})`,
          detail: truncate(url, 160),
        }),
      );
    }
  }
  return findings;
}

/**
 * Extract resolved/tarball/url source URLs from any npm-family lockfile (package-lock.json,
 * yarn.lock, pnpm-lock.yaml) via a text scan - robust across the different lockfile formats,
 * including pnpm's *unquoted* YAML scalars (e.g. `tarball: https://...`, `url: git+...`).
 * @param {string} text lockfile content
 * @return {Set<string>} resolved URLs
 */
function extractResolvedUrls(text) {
  const urls = new Set();
  const add = (u) => {
    if (u && /^(?:https?:\/\/|git\+)/i.test(u)) urls.add(u);
  };

  // Quoted forms: package-lock.json ("resolved": "..."), yarn.lock (resolved "...").
  const quoted = /(?:"resolved"\s*:\s*"|resolved\s+"|tarball:\s*['"])([^"'\s]+)/g;
  let m;
  while ((m = quoted.exec(text)) !== null) add(m[1]);

  // Unquoted YAML scalars (pnpm-lock.yaml): `tarball: <url>`, `url: <url>`, `resolved: <url>`.
  // The keys here are bare (no surrounding quotes), which distinguishes them from the quoted
  // "resolved"/"url" keys in package-lock.json handled above.
  const unquoted =
    /(?:\btarball|\bresolved|\burl)\s*:\s*(https?:\/\/[^\s,'"}\]]+|git\+[^\s,'"}\]]+)/gi;
  while ((m = unquoted.exec(text)) !== null) add(m[1]);

  return urls;
}
