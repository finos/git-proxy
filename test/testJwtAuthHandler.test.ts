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

import axios from 'axios';
import crypto from 'crypto';
import express, { Request } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';

import * as config from '../src/config';
import * as db from '../src/db';
import { Proxy } from '../src/proxy';
import { createApiMiddleware } from '../src/service/orpc';
import { assignRoles, getJwks, validateJwt } from '../src/service/passport/jwtUtils';
import { AuthenticationElementType, JwtConfig, RoleMapping } from '../src/config/generated/config';

function generateRsaKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { format: 'pem', type: 'pkcs1' },
    privateKeyEncoding: { format: 'pem', type: 'pkcs1' },
  });
}

function publicKeyToJwk(publicKeyPem, kid = 'test-key') {
  const keyObj = crypto.createPublicKey(publicKeyPem);
  const jwk = keyObj.export({ format: 'jwk' });
  return { ...jwk, kid };
}

describe('JWT', () => {
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
      const axiosStub = vi.spyOn(axios, 'get');

      axiosStub.mockResolvedValueOnce({ data: { jwks_uri: 'https://mock.com/jwks' } });
      axiosStub.mockResolvedValueOnce({ data: jwksResponse });

      getJwksStub = vi.fn().mockResolvedValue(jwksResponse.keys);

      decodeStub = vi.spyOn(jwt, 'decode');
      verifyStub = vi.spyOn(jwt, 'verify');
    });

    afterEach(() => vi.restoreAllMocks());

    it('should validate a correct JWT', async () => {
      const mockJwk = { kid: '123', kty: 'RSA', n: 'abc', e: 'AQAB' };

      decodeStub.mockReturnValue({ header: { kid: '123' } });
      getJwksStub.mockResolvedValue([mockJwk]);
      verifyStub.mockReturnValue({ azp: 'client-id', sub: 'user123' });

      const { verifiedPayload, error } = await validateJwt(
        'fake.token.here',
        'https://issuer.com',
        'client-id',
        'client-id',
        getJwksStub,
      );

      expect(error).toBeNull();
      expect(verifiedPayload?.sub).toBe('user123');
    });

    it('should return error if JWT invalid', async () => {
      decodeStub.mockReturnValue(null);

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

  describe('validateJwt with real JWT', () => {
    it('should validate a JWT generated with crypto.createPublicKey', async () => {
      const { privateKey, publicKey } = generateRsaKeyPair();
      const jwk = publicKeyToJwk(publicKey, 'my-kid');

      const tokenPayload = jwt.sign(
        {
          sub: 'user123',
          azp: 'client-id',
          admin: 'admin',
        },
        privateKey,
        {
          algorithm: 'RS256',
          issuer: 'https://issuer.com',
          audience: 'client-id',
          keyid: 'my-kid',
        },
      );

      const getJwksStub = vi.fn().mockResolvedValue([jwk]);

      const { verifiedPayload, error } = await validateJwt(
        tokenPayload,
        'https://issuer.com',
        'client-id',
        'client-id',
        getJwksStub,
      );

      expect(error).toBeNull();
      expect(verifiedPayload?.sub).toBe('user123');
      expect(verifiedPayload?.admin).toBe('admin');
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

      assignRoles({} as RoleMapping, payload, user);
      expect(user.admin).toBeUndefined();
    });
  });

  describe('jwtAuthHandler', () => {
    let isAuthenticated: boolean;
    let jwtConfig: JwtConfig;
    let validVerifyResponse: JwtPayload;

    // The JWT guard runs in front of every /api/v1/{push,repo,user} procedure.
    const newApp = () => {
      const app = express();
      app.use((req, _res, next) => {
        req.isAuthenticated = (() => isAuthenticated) as Request['isAuthenticated'];
        next();
      });
      app.use(createApiMiddleware(new Proxy()));
      return app;
    };

    const enableJwt = () =>
      vi
        .spyOn(config, 'getAPIAuthMethods')
        .mockReturnValue([{ type: 'jwt' as AuthenticationElementType, enabled: true, jwtConfig }]);

    beforeEach(() => {
      isAuthenticated = false;
      vi.spyOn(db, 'getPushes').mockResolvedValue([]);

      jwtConfig = {
        clientID: 'client-id',
        authorityURL: 'https://accounts.google.com',
        expectedAudience: 'expected-audience',
        roleMapping: { admin: { admin: 'admin' } },
      };

      validVerifyResponse = {
        header: { kid: '123' },
        azp: 'client-id',
        sub: 'user123',
        admin: 'admin',
      };
    });

    afterEach(() => vi.restoreAllMocks());

    it('should call next if user is authenticated', async () => {
      isAuthenticated = true;
      const res = await request(newApp()).get('/api/v1/push');
      expect(res.status).toBe(200);
      expect(db.getPushes).toHaveBeenCalledOnce();
    });

    it('should return 401 if no token provided', async () => {
      enableJwt();
      const res = await request(newApp()).get('/api/v1/push');

      expect(res.status).toBe(401);
      expect(res.text).toBe('No token provided\n');
    });

    it('should return 500 if authorityURL not configured', async () => {
      jwtConfig.authorityURL = null;
      enableJwt();
      vi.spyOn(jwt, 'verify').mockReturnValue(validVerifyResponse as any);

      const res = await request(newApp())
        .get('/api/v1/push')
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'OIDC authority URL is not configured\n' });
    });

    it('should return 500 if clientID not configured', async () => {
      jwtConfig.clientID = null;
      enableJwt();
      vi.spyOn(jwt, 'verify').mockReturnValue(validVerifyResponse as any);

      const res = await request(newApp())
        .get('/api/v1/push')
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ message: 'OIDC client ID is not configured\n' });
    });

    it('should return 401 if JWT validation fails', async () => {
      enableJwt();
      vi.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const res = await request(newApp())
        .get('/api/v1/push')
        .set('Authorization', 'Bearer fake-token');

      expect(res.status).toBe(401);
      expect(res.text).toMatch(/Invalid JWT:/);
    });
  });
});
