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

import { GitProxyConfig } from './generated/config';

/**
 * Returns deprecation warnings for legacy top-level config keys in user overrides.
 * PR 3.0 (#1545) will replace warnings with startup failure for legacy-only configs.
 */
export function getDeprecatedConfigWarnings(userSettings: Partial<GitProxyConfig>): string[] {
  const warnings: string[] = [];

  if (userSettings.sslKeyPemPath?.trim() && !userSettings.tls?.key?.trim()) {
    warnings.push('"sslKeyPemPath" is deprecated; use "tls.key" instead (removal in GitProxy 3.0)');
  }

  if (userSettings.sslCertPemPath?.trim() && !userSettings.tls?.cert?.trim()) {
    warnings.push(
      '"sslCertPemPath" is deprecated; use "tls.cert" instead (removal in GitProxy 3.0)',
    );
  }

  if (typeof userSettings.proxyUrl === 'string' && userSettings.proxyUrl.trim() !== '') {
    warnings.push('"proxyUrl" is deprecated and ignored; remove it before GitProxy 3.0');
  }

  return warnings;
}
