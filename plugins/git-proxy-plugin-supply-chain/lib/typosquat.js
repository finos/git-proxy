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

import { NPM_POPULAR } from './data/npm-popular.js';
import { PYPI_POPULAR } from './data/pypi-popular.js';

const NPM_SET = new Set(NPM_POPULAR.map((n) => n.toLowerCase()));
const PYPI_SET = new Set(PYPI_POPULAR.map((n) => n.toLowerCase()));

/**
 * Levenshtein edit distance between two strings.
 * @param {string} a first string
 * @param {string} b second string
 * @return {number} edit distance
 */
export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * If `name` looks like a typosquat of a package in `popularSet`, return that popular package
 * name; otherwise null. A name that IS itself popular (or allow-listed) is never flagged.
 * @param {string} name candidate package name
 * @param {Set<string>} popularSet lowercased popular package names
 * @param {string[]} [allow] package names to never flag
 * @return {string | null} the popular package being impersonated, or null
 */
function nearestInSet(name, popularSet, allow = []) {
  if (!name || typeof name !== 'string') return null;
  const lower = name.toLowerCase();
  if (popularSet.has(lower)) return null;
  if (allow.includes(name) || allow.includes(lower)) return null;

  // Compare the unscoped part (e.g. '@acme/lodahs' -> 'lodahs').
  const bare = lower.startsWith('@') ? lower.split('/').pop() : lower;
  if (!bare || bare.length < 4) return null; // too short -> too noisy to be useful

  let best = null;
  let bestDist = Infinity;
  for (const pop of popularSet) {
    const d = levenshtein(bare, pop);
    if (d < bestDist) {
      bestDist = d;
      best = pop;
    }
    if (bestDist === 1) break;
  }

  // Exact match after unscoping is not a typo (bestDist 0). Distance 1 is always suspicious;
  // allow distance 2 only for longer names where a 2-char slip is still plausibly a typo.
  const threshold = bare.length >= 6 ? 2 : 1;
  if (best && bestDist > 0 && bestDist <= threshold) return best;
  return null;
}

/**
 * Typosquat check against the popular npm package list.
 * @param {string} name candidate package name
 * @param {string[]} [allow] package names to never flag
 * @return {string | null} the popular package being impersonated, or null
 */
export function nearestPopular(name, allow = []) {
  return nearestInSet(name, NPM_SET, allow);
}

/**
 * Typosquat check against the popular PyPI package list.
 * @param {string} name candidate package name
 * @param {string[]} [allow] package names to never flag
 * @return {string | null} the popular package being impersonated, or null
 */
export function nearestPopularPython(name, allow = []) {
  return nearestInSet(name, PYPI_SET, allow);
}
