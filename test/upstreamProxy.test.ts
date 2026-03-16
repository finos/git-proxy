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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { buildUpstreamProxyAgent } from '../src/proxy/routes';
import * as config from '../src/config';

vi.mock('../src/config', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getUpstreamProxyConfig: vi.fn(),
  };
});

describe('buildUpstreamProxyAgent', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({});
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns undefined when no proxy configuration or environment variables are set', () => {
    const agent = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(agent).toBeUndefined();
  });

  it('uses upstreamProxy.url when enabled in configuration', () => {
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({
      enabled: true,
      url: 'http://proxy.example.com:8080',
    });

    const agent = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(agent).toBeDefined();
  });

  it('prefers configuration URL over environment variables', () => {
    process.env.HTTPS_PROXY = 'http://env-proxy.example.com:8080';
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({
      enabled: true,
      url: 'http://config-proxy.example.com:8080',
    });

    const agent = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(agent).toBeDefined();
    expect(agent?.proxy.href).toBe('http://config-proxy.example.com:8080/');
  });

  it('creates an agent when only HTTPS_PROXY is set and config is empty', () => {
    process.env.HTTPS_PROXY = 'http://env-proxy.example.com:8080';
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({});

    const agent = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(agent).toBeDefined();
    expect(agent?.proxy.href).toBe('http://env-proxy.example.com:8080/');
  });

  it('does not create an agent when upstreamProxy.enabled is false', () => {
    process.env.HTTPS_PROXY = 'http://env-proxy.example.com:8080';
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({
      enabled: false,
      url: 'http://config-proxy.example.com:8080',
    });

    const agent = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(agent).toBeUndefined();
  });

  it('bypasses proxy when host matches noProxy in configuration', () => {
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({
      enabled: true,
      url: 'http://config-proxy.example.com:8080',
      noProxy: ['github.com'],
    });

    const agent = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(agent).toBeUndefined();
  });

  it('bypasses proxy when host matches NO_PROXY environment variable', () => {
    process.env.HTTPS_PROXY = 'http://env-proxy.example.com:8080';
    process.env.NO_PROXY = 'github.com';

    const agent = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(agent).toBeUndefined();
  });
});
