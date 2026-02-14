/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('auth methods', () => {
  beforeEach(() => {
    vi.doUnmock('fs');
    vi.resetModules();
  });

  it('should return a local auth method by default', async () => {
    const config = await import('../src/config');
    const authMethods = config.getAuthMethods();
    expect(authMethods).toHaveLength(1);
    expect(authMethods[0].type).toBe('local');
  });

  it('should return an error if no auth methods are enabled', async () => {
    const newConfig = JSON.stringify({
      authentication: [
        { type: 'local', enabled: false },
        { type: 'ActiveDirectory', enabled: false },
        { type: 'openidconnect', enabled: false },
      ],
    });

    vi.doMock('fs', () => ({
      existsSync: () => true,
      readFileSync: () => newConfig,
    }));

    const config = await import('../src/config');
    config.initUserConfig();

    expect(() => config.getAuthMethods()).toThrowError(/No authentication method enabled/);
  });

  it('should return an array of enabled auth methods when overridden', async () => {
    const newConfig = JSON.stringify({
      authentication: [
        { type: 'local', enabled: true },
        { type: 'ActiveDirectory', enabled: true },
        { type: 'openidconnect', enabled: true },
      ],
    });

    vi.doMock('fs', () => ({
      existsSync: () => true,
      readFileSync: () => newConfig,
    }));

    const config = await import('../src/config');
    config.initUserConfig();

    const authMethods = config.getAuthMethods();
    expect(authMethods).toHaveLength(3);
    expect(authMethods[0].type).toBe('local');
    expect(authMethods[1].type).toBe('ActiveDirectory');
    expect(authMethods[2].type).toBe('openidconnect');
  });
});
