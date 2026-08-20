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

export const SEVERITY = {
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// Ordered lowest -> highest. 'off' is only ever used as a `failOn` threshold sentinel
// meaning "never block"; it is not a valid finding severity.
const ORDER = ['off', 'info', 'low', 'medium', 'high', 'critical'];

/**
 * Numeric rank of a severity/threshold value (higher = more severe). Unknown values rank 0.
 * @param {string} sev severity or threshold string
 * @return {number} rank
 */
export function rank(sev) {
  const i = ORDER.indexOf(sev);
  return i === -1 ? 0 : i;
}

/**
 * True when `sev` meets or exceeds `threshold`. A threshold of 'off' (rank 0) never matches.
 * @param {string} sev finding severity
 * @param {string} threshold configured failure threshold
 * @return {boolean} whether the severity crosses the threshold
 */
export function rankAtLeast(sev, threshold) {
  return rank(threshold) > 0 && rank(sev) >= rank(threshold);
}

/**
 * Highest severity among the given values, defaulting to INFO when empty.
 * @param {string[]} severities list of severities
 * @return {string} the maximum severity
 */
export function maxSeverity(severities) {
  return severities.reduce((acc, s) => (rank(s) > rank(acc) ? s : acc), SEVERITY.INFO);
}
