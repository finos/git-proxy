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
import { getDeprecatedConfigWarnings } from '../src/config/deprecatedFields';

describe('getDeprecatedConfigWarnings', () => {
  it('returns warnings for legacy TLS-only user config', () => {
    const warnings = getDeprecatedConfigWarnings({
      sslKeyPemPath: 'key.pem',
      sslCertPemPath: 'cert.pem',
    });

    expect(warnings).toHaveLength(2);
    expect(warnings).toContain(
      '"sslKeyPemPath" is deprecated; use "tls.key" instead (removal in GitProxy 3.0)',
    );
    expect(warnings).toContain(
      '"sslCertPemPath" is deprecated; use "tls.cert" instead (removal in GitProxy 3.0)',
    );
  });

  it('warns for a deprecated field that has no replacement', () => {
    expect(getDeprecatedConfigWarnings({ proxyUrl: 'https://github.com' })).toEqual([
      '"proxyUrl" is deprecated and ignored; remove it before GitProxy 3.0',
    ]);
  });

  it('treats non-string values as set', () => {
    expect(getDeprecatedConfigWarnings({ proxyUrl: 0 } as never)).toHaveLength(1);
    expect(getDeprecatedConfigWarnings({ proxyUrl: false } as never)).toHaveLength(1);
  });

  it('stays quiet when the replacement is already set', () => {
    expect(
      getDeprecatedConfigWarnings({
        sslKeyPemPath: 'key.pem',
        sslCertPemPath: 'cert.pem',
        tls: { enabled: true, key: 'k.pem', cert: 'c.pem' },
      }),
    ).toEqual([]);
  });

  it('returns no warnings for non-deprecated overrides', () => {
    expect(getDeprecatedConfigWarnings({ uiPort: 9000 })).toEqual([]);
    expect(
      getDeprecatedConfigWarnings({
        tls: { enabled: true, key: 'k.pem', cert: 'c.pem' },
      }),
    ).toEqual([]);
  });
});
