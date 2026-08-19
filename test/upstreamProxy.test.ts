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

import { buildUpstreamProxyAgent, getOrCreateProxyAgent } from '../src/proxy/routes';
import * as config from '../src/config';
import { AuthType } from '../src/config/generated/config';
import { NtlmProxyAgent } from '../src/proxy/upstream/ntlm-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

vi.mock('../src/config', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    getUpstreamProxyConfig: vi.fn(),
  };
});

// Narrow http.Agent → HttpsProxyAgent for Basic / no-auth assertions.
const asHttps = (agent: unknown): HttpsProxyAgent<string> => {
  if (!(agent instanceof HttpsProxyAgent)) {
    throw new Error(`expected HttpsProxyAgent, got ${agent?.constructor?.name ?? typeof agent}`);
  }
  return agent;
};

describe('getOrCreateProxyAgent', () => {
  it('accepts http:// URLs', () => {
    expect(() => getOrCreateProxyAgent('http://proxy.example.com:8080')).not.toThrow();
  });

  it('accepts https:// URLs', () => {
    expect(() => getOrCreateProxyAgent('https://proxy.example.com:8080')).not.toThrow();
  });

  it('rejects socks5:// URLs with a descriptive error', () => {
    expect(() => getOrCreateProxyAgent('socks5://proxy.example.com:1080')).toThrow(
      /unsupported.*scheme.*socks5/i,
    );
  });

  it('rejects ftp:// URLs with a descriptive error', () => {
    expect(() => getOrCreateProxyAgent('ftp://proxy.example.com:21')).toThrow(
      /unsupported.*scheme.*ftp/i,
    );
  });

  it('rejects URLs without a protocol (no scheme)', () => {
    expect(() => getOrCreateProxyAgent('localhost:8081')).toThrow(
      /Unsupported upstream proxy URL scheme/i,
    );
  });

  it('rejects URLs with an empty hostname', () => {
    expect(() => getOrCreateProxyAgent('http://:8080')).toThrow(/invalid upstream proxy url/i);
  });

  it('rejects completely invalid URL strings', () => {
    expect(() => getOrCreateProxyAgent('not a url at all')).toThrow(/invalid upstream proxy url/i);
  });
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
    expect(asHttps(agent).proxy.href).toBe('http://config-proxy.example.com:8080/');
  });

  it('creates an agent when only HTTPS_PROXY is set and config is empty', () => {
    process.env.HTTPS_PROXY = 'http://env-proxy.example.com:8080';
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({ enabled: true });

    const agent = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(agent).toBeDefined();
    expect(asHttps(agent).proxy.href).toBe('http://env-proxy.example.com:8080/');
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

  it('builds a Basic Proxy-Authorization header from structured auth config', () => {
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({
      enabled: true,
      url: 'http://proxy.example.com:8080',
      auth: { type: AuthType.Basic, username: 'alice', password: 's3cret' },
    });

    const agent = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(agent).toBeDefined();

    const headers = asHttps(agent).proxyHeaders as Record<string, string>;
    const expected = `Basic ${Buffer.from('alice:s3cret').toString('base64')}`;
    expect(headers['Proxy-Authorization']).toBe(expected);
  });

  it('returns a fresh agent when auth credentials change', () => {
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({
      enabled: true,
      url: 'http://proxy.example.com:8080',
      auth: { type: AuthType.Basic, username: 'alice', password: 's3cret' },
    });
    const first = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });

    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({
      enabled: true,
      url: 'http://proxy.example.com:8080',
      auth: { type: AuthType.Basic, username: 'alice', password: 'rotated' },
    });
    const second = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(second).not.toBe(first);

    const headers = asHttps(second).proxyHeaders as Record<string, string>;
    expect(headers['Proxy-Authorization']).toBe(
      `Basic ${Buffer.from('alice:rotated').toString('base64')}`,
    );
  });

  it('strips URL userinfo when structured auth is provided so structured auth wins', () => {
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({
      enabled: true,
      url: 'http://urluser:urlpass@proxy.example.com:8080',
      auth: { type: AuthType.Basic, username: 'alice', password: 's3cret' },
    });

    const agent = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(agent).toBeDefined();
    expect(asHttps(agent).proxy.username).toBe('');
    expect(asHttps(agent).proxy.password).toBe('');

    const headers = asHttps(agent).proxyHeaders as Record<string, string>;
    expect(headers['Proxy-Authorization']).toBe(
      `Basic ${Buffer.from('alice:s3cret').toString('base64')}`,
    );
  });

  it('leaves URL userinfo intact when no structured auth is provided', () => {
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({
      enabled: true,
      url: 'http://urluser:urlpass@proxy.example.com:8080',
    });

    const agent = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(agent).toBeDefined();
    expect(asHttps(agent).proxy.username).toBe('urluser');
    expect(asHttps(agent).proxy.password).toBe('urlpass');
  });

  it('returns an NtlmProxyAgent when auth.type is ntlm', () => {
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({
      enabled: true,
      url: 'http://proxy.example.com:8080',
      auth: {
        type: AuthType.NTLM,
        username: 'alice',
        password: 's3cret',
        domain: 'CORP',
        workstation: 'LAPTOP-42',
      },
    });

    const agent = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(agent).toBeInstanceOf(NtlmProxyAgent);
  });

  it('returns a fresh agent when switching from Basic to NTLM', () => {
    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({
      enabled: true,
      url: 'http://proxy.example.com:8080',
      auth: { type: AuthType.Basic, username: 'alice', password: 's3cret' },
    });
    const first = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(first).toBeInstanceOf(HttpsProxyAgent);

    vi.mocked(config.getUpstreamProxyConfig).mockReturnValue({
      enabled: true,
      url: 'http://proxy.example.com:8080',
      auth: { type: AuthType.NTLM, username: 'alice', password: 's3cret' },
    });
    const second = buildUpstreamProxyAgent({ host: 'github.com', headers: {} });
    expect(second).toBeInstanceOf(NtlmProxyAgent);
    expect(second).not.toBe(first);
  });
});
