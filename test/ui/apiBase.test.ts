import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

async function loadApiBase() {
  const path = '../../src/ui/apiBase.ts';
  const modulePath = await import(path + '?update=' + Date.now()); // forces reload
  return modulePath;
}

describe('apiBase', () => {
  let originalEnv: string | undefined;
  const originalLocation = globalThis.location;

  beforeAll(() => {
    globalThis.location = { origin: 'https://lovely-git-proxy.com' } as any;
  });

  afterAll(() => {
    globalThis.location = originalLocation;
  });

  beforeEach(() => {
    originalEnv = process.env.VITE_API_URI;
    delete process.env.VITE_API_URI;
  });

  afterEach(() => {
    if (typeof originalEnv === 'undefined') {
      delete process.env.VITE_API_URI;
    } else {
      process.env.VITE_API_URI = originalEnv;
    }
  });

  it('uses the location origin when VITE_API_URI is not set', async () => {
    const { API_BASE } = await loadApiBase();
    expect(API_BASE).toBe('https://lovely-git-proxy.com');
  });

  it('returns the exact value when no trailing slash', async () => {
    process.env.VITE_API_URI = 'https://example.com';
    const { API_BASE } = await loadApiBase();
    expect(API_BASE).toBe('https://example.com');
  });

  it('strips trailing slashes from VITE_API_URI', async () => {
    process.env.VITE_API_URI = 'https://example.com////';
    const { API_BASE } = await loadApiBase();
    expect(API_BASE).toBe('https://example.com');
  });
});
