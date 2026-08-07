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

import { describe, it, expect, vi } from 'vitest';
import { ScmMetadataCache, cacheKeyForRepoUrl } from '../../src/service/scmMetadata';

describe('cacheKeyForRepoUrl', () => {
  it('strips .git and lowercases host and path', () => {
    expect(cacheKeyForRepoUrl('https://GitHub.com/Foo/Bar.git')).toBe('https://github.com/foo/bar');
  });
});

describe('ScmMetadataCache', () => {
  it('fetches once for repeated gets within TTL', async () => {
    const fetcher = vi.fn().mockResolvedValue({ description: 'readme' });
    const cache = new ScmMetadataCache(60_000, 5_000, fetcher);
    await cache.get('finos', 'git-proxy', 'https://github.com/finos/git-proxy.git');
    await cache.get('finos', 'git-proxy', 'https://github.com/finos/git-proxy');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      'finos',
      'git-proxy',
      'https://github.com/finos/git-proxy.git',
    );
  });

  it('returns stale value after TTL then serves refreshed data', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ description: 'v1' })
      .mockResolvedValueOnce({ description: 'v2' });
    const cache = new ScmMetadataCache(25, 25, fetcher);

    const first = await cache.get('a', 'b', 'https://github.com/a/b.git');
    expect(first?.description).toBe('v1');
    expect(fetcher).toHaveBeenCalledTimes(1);

    await new Promise((r) => setTimeout(r, 40));

    const stale = await cache.get('a', 'b', 'https://github.com/a/b.git');
    expect(stale?.description).toBe('v1');

    await vi.waitFor(
      () => {
        expect(fetcher).toHaveBeenCalledTimes(2);
      },
      { interval: 5, timeout: 3_000 },
    );

    const fresh = await cache.get('a', 'b', 'https://github.com/a/b.git');
    expect(fresh?.description).toBe('v2');
  });
});
