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

import express, { Express } from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import repo from '../../../src/service/routes/repo';
import { Proxy } from '../../../src/proxy';
import * as db from '../../../src/db';

const { getCachedScmRepositoryMetadataMock } = vi.hoisted(() => ({
  getCachedScmRepositoryMetadataMock: vi.fn(),
}));

vi.mock('../../../src/service/scmMetadata', () => ({
  getCachedScmRepositoryMetadata: getCachedScmRepositoryMetadataMock,
  fetchScmRepositoryMetadata: vi.fn(),
  ScmMetadataCache: class {},
  cacheKeyForRepoUrl: (u: string) => u,
  scmMetadataTtls: { successMs: 1, failureMs: 1 },
  clearDefaultScmMetadataCache: vi.fn(),
}));

describe('GET /api/v1/repo/:id/scm-metadata', () => {
  let app: Express;
  const proxy = new Proxy();

  beforeEach(() => {
    getCachedScmRepositoryMetadataMock.mockReset();
    getCachedScmRepositoryMetadataMock.mockResolvedValue({
      description: 'from-cache',
    });
    app = express();
    app.use(express.json());
    app.use('/api/v1/repo', repo(proxy));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 404 when repository id is unknown', async () => {
    vi.spyOn(db, 'getRepoById').mockResolvedValue(null);
    const res = await request(app).get('/api/v1/repo/unknown-id/scm-metadata');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: 'Repository not found' });
    expect(getCachedScmRepositoryMetadataMock).not.toHaveBeenCalled();
  });

  it('returns JSON from getCachedScmRepositoryMetadata', async () => {
    vi.spyOn(db, 'getRepoById').mockResolvedValue({
      project: 'finos',
      name: 'git-proxy',
      url: 'https://github.com/finos/git-proxy.git',
      users: { canPush: [], canAuthorise: [] },
      _id: 'r1',
    });

    const res = await request(app).get('/api/v1/repo/r1/scm-metadata');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ description: 'from-cache' });
    expect(getCachedScmRepositoryMetadataMock).toHaveBeenCalledWith(
      'finos',
      'git-proxy',
      'https://github.com/finos/git-proxy.git',
    );
  });

  it('serializes null metadata as JSON null', async () => {
    getCachedScmRepositoryMetadataMock.mockResolvedValue(null);
    vi.spyOn(db, 'getRepoById').mockResolvedValue({
      project: 'x',
      name: 'y',
      url: 'https://example.com/x/y.git',
      users: { canPush: [], canAuthorise: [] },
      _id: 'r2',
    });

    const res = await request(app).get('/api/v1/repo/r2/scm-metadata');

    expect(res.status).toBe(200);
    expect(res.text).toBe('null');
  });
});
