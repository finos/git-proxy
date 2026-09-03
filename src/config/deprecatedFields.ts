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

import _ from 'lodash';
import schema from '../../config.schema.json';
import { GitProxyConfig } from './generated/config';

interface SchemaProperty {
  deprecated?: boolean;
  'x-deprecated-replacement'?: string;
}

const schemaProperties = (schema as { properties: Record<string, SchemaProperty> }).properties;

function isSet(value: unknown): boolean {
  return (
    value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '')
  );
}

/**
 * Returns deprecation warnings for legacy top-level config keys in user overrides.
 * PR 3.0 (#1545) will replace warnings with startup failure for legacy-only configs.
 */
export function getDeprecatedConfigWarnings(userSettings: Partial<GitProxyConfig>): string[] {
  const settings = userSettings as Record<string, unknown>;
  const warnings: string[] = [];

  for (const [key, property] of Object.entries(schemaProperties)) {
    if (!property.deprecated || !isSet(settings[key])) {
      continue;
    }

    const replacement = property['x-deprecated-replacement'];
    if (!replacement) {
      warnings.push(`"${key}" is deprecated and ignored; remove it before GitProxy 3.0`);
    } else if (!isSet(_.get(settings, replacement))) {
      warnings.push(
        `"${key}" is deprecated; use "${replacement}" instead (removal in GitProxy 3.0)`,
      );
    }
  }

  return warnings;
}
