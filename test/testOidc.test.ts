import { describe, it, beforeEach, afterEach, expect, vi, type Mock } from 'vitest';

import {
  safelyExtractEmail,
  getUsername,
  handleUserAuthentication,
} from '../src/service/passport/oidc';

describe('OIDC auth method', () => {
  let dbStub: any;
  let passportStub: any;
  let configure: any;
  let discoveryStub: Mock;
  let fetchUserInfoStub: Mock;

  const newConfig = JSON.stringify({
    authentication: [
      {
        type: 'openidconnect',
        enabled: true,
        oidcConfig: {
          issuer: 'https://fake-issuer.com',
          clientID: 'test-client-id',
          clientSecret: 'test-client-secret',
          callbackURL: 'https://example.com/callback',
          scope: 'openid profile email',
        },
      },
    ],
  });

  beforeEach(async () => {
    dbStub = {
      findUserByOIDC: vi.fn(),
      createUser: vi.fn(),
    };

    passportStub = {
      use: vi.fn(),
      serializeUser: vi.fn(),
      deserializeUser: vi.fn(),
    };

    discoveryStub = vi.fn().mockResolvedValue({ some: 'config' });
    fetchUserInfoStub = vi.fn();

    const strategyCtorStub = function (_options: any, verifyFn: any) {
      return {
        name: 'openidconnect',
        currentUrl: vi.fn().mockReturnValue({}),
      };
    };

    // First mock the dependencies
    vi.resetModules();
    vi.doMock('../src/config', async () => {
      const actual = await vi.importActual<any>('../src/config');
      return {
        ...actual,
        default: {
          ...actual.default,
          initUserConfig: vi.fn(),
        },
        initUserConfig: vi.fn(),
      };
    });
    vi.doMock('fs', async (importOriginal) => {
      const actual: any = await importOriginal();
      return {
        ...actual,
        existsSync: vi.fn().mockReturnValue(true),
        readFileSync: vi.fn().mockReturnValue(newConfig),
      };
    });
    vi.doMock('../../db', () => dbStub);
    vi.doMock('../../config', async () => {
      const actual = await vi.importActual<any>('../src/config');
      return actual;
    });
    vi.doMock('openid-client', () => ({
      discovery: discoveryStub,
      fetchUserInfo: fetchUserInfoStub,
    }));
    vi.doMock('openid-client/passport', () => ({
      Strategy: strategyCtorStub,
    }));

    // then import fresh OIDC module with mocks applied
    const oidcModule = await import('../src/service/passport/oidc');
    configure = oidcModule.configure;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should configure passport with OIDC strategy', async () => {
    await configure(passportStub);

    expect(discoveryStub).toHaveBeenCalledOnce();
    expect(passportStub.use).toHaveBeenCalledOnce();
    expect(passportStub.serializeUser).toHaveBeenCalledOnce();
    expect(passportStub.deserializeUser).toHaveBeenCalledOnce();
  });

  it('should authenticate an existing user', async () => {
    dbStub.findUserByOIDC.mockResolvedValue({ id: 'user123', username: 'test-user' });

    const done = vi.fn();
    await handleUserAuthentication({ sub: 'user123', email: 'user123@test.com' }, done);

    expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ username: 'user123' }));
  });

  it('should handle discovery errors', async () => {
    discoveryStub.mockRejectedValue(new Error('discovery failed'));

    await expect(configure(passportStub)).rejects.toThrow(/discovery failed/);
  });

  it('should fail if no email in new user profile', async () => {
    const done = vi.fn();
    await handleUserAuthentication({ sub: 'sub-no-email' }, done);

    const [err, user] = done.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/No email/);
    expect(user).toBeUndefined();
  });

  describe('safelyExtractEmail', () => {
    it('should extract email from profile', () => {
      const profile = { email: 'test@test.com' };
      const email = safelyExtractEmail(profile);
      expect(email).toBe('test@test.com');
    });

    it('should extract email from profile with emails array', () => {
      const profile = { emails: [{ value: 'test@test.com' }] };
      const email = safelyExtractEmail(profile);
      expect(email).toBe('test@test.com');
    });

    it('should return null if no email in profile', () => {
      const profile = { name: 'test' };
      const email = safelyExtractEmail(profile);
      expect(email).toBeNull();
    });
  });

  describe('getUsername', () => {
    it('should generate username from email', () => {
      const email = 'test@test.com';
      const username = getUsername(email);
      expect(username).toBe('test');
    });

    it('should return empty string if no email', () => {
      const email = '';
      const username = getUsername(email);
      expect(username).toBe('');
    });
  });
});
