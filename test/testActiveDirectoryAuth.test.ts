import { describe, it, beforeEach, expect, vi, type Mock, afterEach } from 'vitest';

let ldapStub: { isUserInAdGroup: Mock };
let dbStub: { updateUser: Mock };
let passportStub: {
  use: Mock;
  serializeUser: Mock;
  deserializeUser: Mock;
};
let strategyCallback: (
  req: any,
  profile: any,
  ad: any,
  done: (err: any, user: any) => void,
) => void;

const newConfig = JSON.stringify({
  authentication: [
    {
      type: 'ActiveDirectory',
      enabled: true,
      adminGroup: 'test-admin-group',
      userGroup: 'test-user-group',
      domain: 'test.com',
      adConfig: {
        url: 'ldap://test-url',
        baseDN: 'dc=test,dc=com',
        searchBase: 'ou=users,dc=test,dc=com',
      },
    },
  ],
});

describe('ActiveDirectory auth method', () => {
  beforeEach(async () => {
    ldapStub = {
      isUserInAdGroup: vi.fn(),
    };

    dbStub = {
      updateUser: vi.fn(),
    };

    passportStub = {
      use: vi.fn(),
      serializeUser: vi.fn(),
      deserializeUser: vi.fn(),
    };

    // mock fs for config
    vi.doMock('fs', (importOriginal) => {
      const actual = importOriginal();
      return {
        ...actual,
        existsSync: vi.fn().mockReturnValue(true),
        readFileSync: vi.fn().mockReturnValue(newConfig),
      };
    });

    // mock ldaphelper before importing activeDirectory
    vi.doMock('../src/service/passport/ldaphelper', () => ldapStub);
    vi.doMock('../src/db', () => dbStub);

    vi.doMock('passport-activedirectory', () => ({
      default: function (options: any, callback: (err: any, user: any) => void) {
        strategyCallback = callback;
        return {
          name: 'ActiveDirectory',
          authenticate: () => {},
        };
      },
    }));

    // First import config
    const config = await import('../src/config');
    config.initUserConfig();
    vi.doMock('../src/config', () => config);

    // then configure activeDirectory
    const { configure } = await import('../src/service/passport/activeDirectory.js');
    configure(passportStub as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should authenticate a valid user and mark them as admin', async () => {
    const mockReq = {};
    const mockProfile = {
      _json: {
        sAMAccountName: 'test-user',
        mail: 'test@test.com',
        userPrincipalName: 'test@test.com',
        title: 'Test User',
      },
      displayName: 'Test User',
    };

    (ldapStub.isUserInAdGroup as Mock)
      .mockResolvedValueOnce(true) // adminGroup check
      .mockResolvedValueOnce(true); // userGroup check

    const done = vi.fn();

    await strategyCallback(mockReq, mockProfile, {}, done);

    expect(done).toHaveBeenCalledOnce();
    const [err, user] = done.mock.calls[0];
    expect(err).toBeNull();
    expect(user).toMatchObject({
      username: 'test-user',
      email: 'test@test.com',
      displayName: 'Test User',
      admin: true,
      title: 'Test User',
    });

    expect(dbStub.updateUser).toHaveBeenCalledOnce();
  });

  it('should fail if user is not in user group', async () => {
    const mockReq = {};
    const mockProfile = {
      _json: {
        sAMAccountName: 'bad-user',
        mail: 'bad@test.com',
        userPrincipalName: 'bad@test.com',
        title: 'Bad User',
      },
      displayName: 'Bad User',
    };

    (ldapStub.isUserInAdGroup as Mock).mockResolvedValueOnce(false);

    const done = vi.fn();

    await strategyCallback(mockReq, mockProfile, {}, done);

    expect(done).toHaveBeenCalledOnce();
    const [err, user] = done.mock.calls[0];
    expect(err).toContain('not a member');
    expect(user).toBeNull();

    expect(dbStub.updateUser).not.toHaveBeenCalled();
  });

  it('should handle LDAP errors gracefully', async () => {
    const mockReq = {};
    const mockProfile = {
      _json: {
        sAMAccountName: 'error-user',
        mail: 'err@test.com',
        userPrincipalName: 'err@test.com',
        title: 'Whoops',
      },
      displayName: 'Error User',
    };

    (ldapStub.isUserInAdGroup as Mock).mockRejectedValueOnce(new Error('LDAP error'));

    const done = vi.fn();

    await strategyCallback(mockReq, mockProfile, {}, done);

    expect(done).toHaveBeenCalledOnce();
    const [err, user] = done.mock.calls[0];
    expect(err).toContain('LDAP error');
    expect(user).toBeNull();
  });
});
