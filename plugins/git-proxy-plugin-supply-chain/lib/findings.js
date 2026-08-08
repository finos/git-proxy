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

import { rank, SEVERITY } from './severity.js';

/**
 * @typedef {Object} Finding
 * @property {string} severity one of SEVERITY.*
 * @property {string} ecosystem e.g. 'npm'
 * @property {string} rule stable machine-readable rule id
 * @property {string} file path of the manifest the finding relates to
 * @property {string} title short human-readable summary
 * @property {string} detail optional extra context
 */

/**
 * Build a normalised Finding object.
 * @param {Partial<Finding>} input finding fields
 * @return {Finding} the finding
 */
export function finding({ severity = SEVERITY.INFO, ecosystem, rule, file, title, detail = '' }) {
  return { severity, ecosystem, rule, file, title, detail };
}

const LABEL = {
  info: 'INFO',
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};

/**
 * Render findings into a human-readable report (shown in the review dashboard / git output),
 * ordered most-severe first.
 * @param {Finding[]} findings the findings to render
 * @return {string} the report
 */
export function renderFindings(findings) {
  const sorted = [...findings].sort((a, b) => rank(b.severity) - rank(a.severity));
  const lines = ['Supply-chain scan findings:', ''];
  sorted.forEach((f, i) => {
    const label = LABEL[f.severity] ?? String(f.severity).toUpperCase();
    lines.push(`  #${i + 1} [${label}] (${f.ecosystem}) ${f.title}`);
    lines.push(`      file: ${f.file}`);
    if (f.detail) lines.push(`      ${f.detail}`);
  });
  return lines.join('\n');
}
