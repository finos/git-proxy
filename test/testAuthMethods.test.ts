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
