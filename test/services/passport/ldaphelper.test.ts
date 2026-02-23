import { describe, it, beforeEach, expect, vi, type Mock, afterEach } from 'vitest';
import type ActiveDirectory from 'activedirectory2';

let axiosGetMock: Mock;
let adIsMemberMock: Mock;

const mockProfile = {
  username: 'test-user',
} as any;

const mockReq = {} as any;
const mockDomain = 'test.com';
const mockGroup = 'admins';

describe('ldapHelper - isUserInAdGroup', () => {
  beforeEach(() => {
    vi.resetModules();

    axiosGetMock = vi.fn();
    adIsMemberMock = vi.fn();

    // mock axios
    vi.doMock('axios', () => ({
      default: {
        create: () => ({
          get: axiosGetMock,
        }),
      },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('uses HTTP API when config.ls.userInADGroup is set (success)', async () => {
    vi.doMock('../../../src/config', () => ({
      getAPIs: () => ({
        ls: {
          userInADGroup: 'https://api.test/<domain>/<name>/<id>',
        },
      }),
    }));

    axiosGetMock.mockResolvedValueOnce({ data: true });

    const { isUserInAdGroup } = await import('../../../src/service/passport/ldaphelper');

    const result = await isUserInAdGroup(
      mockReq,
      mockProfile,
      {} as ActiveDirectory,
      mockDomain,
      mockGroup,
    );

    expect(result).toBe(true);
    expect(axiosGetMock).toHaveBeenCalledOnce();
  });

  it('uses HTTP API and returns false on error', async () => {
    vi.doMock('../../../src/config', () => ({
      getAPIs: () => ({
        ls: {
          userInADGroup: 'https://api.test/<domain>/<name>/<id>',
        },
      }),
    }));

    axiosGetMock.mockRejectedValueOnce(new Error('HTTP fail'));

    const { isUserInAdGroup } = await import('../../../src/service/passport/ldaphelper');

    const result = await isUserInAdGroup(
      mockReq,
      mockProfile,
      {} as ActiveDirectory,
      mockDomain,
      mockGroup,
    );

    expect(result).toBe(false);
  });

  it('uses AD directly when HTTP config is not set (success)', async () => {
    vi.doMock('../../../src/config', () => ({
      getAPIs: () => ({
        ls: {},
      }),
    }));

    adIsMemberMock.mockImplementation((_u, _g, cb) => cb(null, true));

    const fakeAd = {
      isUserMemberOf: adIsMemberMock,
    } as unknown as ActiveDirectory;

    const { isUserInAdGroup } = await import('../../../src/service/passport/ldaphelper');

    const result = await isUserInAdGroup(mockReq, mockProfile, fakeAd, mockDomain, mockGroup);

    expect(result).toBe(true);
    expect(adIsMemberMock).toHaveBeenCalledOnce();
  });

  it('rejects when AD throws error', async () => {
    vi.doMock('../../../src/config', () => ({
      getAPIs: () => ({
        ls: {},
      }),
    }));

    adIsMemberMock.mockImplementation((_u, _g, cb) => cb(new Error('AD failure'), null));

    const fakeAd = {
      isUserMemberOf: adIsMemberMock,
    } as unknown as ActiveDirectory;

    const { isUserInAdGroup } = await import('../../../src/service/passport/ldaphelper');

    await expect(
      isUserInAdGroup(mockReq, mockProfile, fakeAd, mockDomain, mockGroup),
    ).rejects.toContain('ERROR isUserMemberOf');
  });
});
