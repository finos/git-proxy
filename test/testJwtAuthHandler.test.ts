import { describe, it, expect, vi, beforeEach, afterEach, Mock, MockInstance } from 'vitest';
import axios from 'axios';
import jwt, { JwtPayload } from 'jsonwebtoken';
import * as jwkToBufferModule from 'jwk-to-pem';

import { assignRoles, getJwks, validateJwt } from '../src/service/passport/jwtUtils';
import { jwtAuthHandler } from '../src/service/passport/jwtAuthHandler';
import { JwtConfig } from '../src/config/generated/config';
import { NextFunction } from 'express';

describe('getJwks', () => {
  afterEach(() => vi.restoreAllMocks());

  it('should fetch JWKS keys from authority', async () => {
    const jwksResponse = { keys: [{ kid: 'test-key', kty: 'RSA', n: 'abc', e: 'AQAB' }] };

    const getStub = vi.spyOn(axios, 'get');
    getStub.mockResolvedValueOnce({ data: { jwks_uri: 'https://mock.com/jwks' } });
    getStub.mockResolvedValueOnce({ data: jwksResponse });

    const keys = await getJwks('https://mock.com');
    expect(keys).toEqual(jwksResponse.keys);
  });

  it('should throw error if fetch fails', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('Network fail'));
    await expect(getJwks('https://fail.com')).rejects.toThrow('Failed to fetch JWKS');
  });
});

describe('validateJwt', () => {
  let decodeStub: MockInstance;
  let verifyStub: MockInstance;
  let getJwksStub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const jwksResponse = { keys: [{ kid: 'test-key', kty: 'RSA', n: 'abc', e: 'AQAB' }] };

    vi.mock('jwk-to-pem', async (importOriginal) => {
      const actual = await importOriginal<typeof jwkToBufferModule>();
      return {
        ...actual,
        default: vi.fn().mockReturnValue('fake-public-key'),
      };
    });

    vi.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: { jwks_uri: 'https://mock.com/jwks' } })
      .mockResolvedValueOnce({ data: jwksResponse });

    getJwksStub = vi.fn().mockResolvedValue(jwksResponse.keys);
    decodeStub = vi.spyOn(jwt, 'decode');
    verifyStub = vi.spyOn(jwt, 'verify') as any;
  });

  afterEach(() => vi.restoreAllMocks());

  it('should validate a correct JWT', async () => {
    const mockJwk = { kid: '123', kty: 'RSA', n: 'abc', e: 'AQAB' };

    decodeStub.mockReturnValue({ header: { kid: '123' } });
    getJwksStub.mockResolvedValue([mockJwk]);
    verifyStub.mockReturnValue({ azp: 'client-id', sub: 'user123' });

    const { verifiedPayload } = await validateJwt(
      'fake.token.here',
      'https://issuer.com',
      'client-id',
      'client-id',
      getJwksStub,
    );
    expect(verifiedPayload?.sub).toBe('user123');
  });

  it('should return error if JWT invalid', async () => {
    decodeStub.mockReturnValue(null); // broken token

    const { error } = await validateJwt(
      'bad.token',
      'https://issuer.com',
      'client-id',
      'client-id',
      getJwksStub,
    );
    expect(error).toContain('Invalid JWT');
  });
});

describe('assignRoles', () => {
  it('should assign admin role based on claim', () => {
    const user = { username: 'admin-user', admin: undefined };
    const payload = { admin: 'admin' };
    const mapping = { admin: { admin: 'admin' } };

    assignRoles(mapping, payload, user);
    expect(user.admin).toBe(true);
  });

  it('should assign multiple roles based on claims', () => {
    const user = { username: 'multi-role-user', admin: undefined, editor: undefined };
    const payload = { 'custom-claim-admin': 'custom-value', editor: 'editor' };
    const mapping = {
      admin: { 'custom-claim-admin': 'custom-value' },
      editor: { editor: 'editor' },
    };

    assignRoles(mapping, payload, user);
    expect(user.admin).toBe(true);
    expect(user.editor).toBe(true);
  });

  it('should not assign role if claim mismatch', () => {
    const user = { username: 'basic-user', admin: undefined };
    const payload = { admin: 'nope' };
    const mapping = { admin: { admin: 'admin' } };

    assignRoles(mapping, payload, user);
    expect(user.admin).toBeUndefined();
  });

  it('should not assign role if no mapping provided', () => {
    const user = { username: 'no-role-user', admin: undefined };
    const payload = { admin: 'admin' };

    assignRoles(undefined, payload, user);
    expect(user.admin).toBeUndefined();
  });
});

describe('jwtAuthHandler', () => {
  let req: any;
  let res: any;
  let next: NextFunction;
  let jwtConfig: JwtConfig;

  beforeEach(() => {
    req = { header: vi.fn(), isAuthenticated: vi.fn(), user: {} };
    res = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    next = vi.fn();

    jwtConfig = {
      clientID: 'client-id',
      authorityURL: 'https://accounts.google.com',
      expectedAudience: 'expected-audience',
      roleMapping: { admin: { admin: 'admin' } },
    };
  });

  afterEach(() => vi.restoreAllMocks());

  it('should call next if user is authenticated', async () => {
    req.isAuthenticated.mockReturnValue(true);
    await jwtAuthHandler()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('should return 401 if no token provided', async () => {
    req.header.mockReturnValue(null);
    await jwtAuthHandler(jwtConfig)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith('No token provided\n');
  });

  it('should return 500 if authorityURL not configured', async () => {
    req.header.mockReturnValue('Bearer fake-token');
    jwtConfig.authorityURL = '';
    vi.spyOn(jwt, 'verify').mockReturnValue();

    await jwtAuthHandler(jwtConfig)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({ message: 'OIDC authority URL is not configured\n' });
  });

  it('should return 500 if clientID not configured', async () => {
    req.header.mockReturnValue('Bearer fake-token');
    jwtConfig.clientID = '';
    vi.spyOn(jwt, 'verify').mockReturnValue();

    await jwtAuthHandler(jwtConfig)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({ message: 'OIDC client ID is not configured\n' });
  });

  it('should return 401 if JWT validation fails', async () => {
    req.header.mockReturnValue('Bearer fake-token');
    vi.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await jwtAuthHandler(jwtConfig)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.send).toHaveBeenCalledWith(expect.stringMatching(/JWT validation failed:/));
  });
});
