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

import crypto from 'crypto';

export type ScmUserInfo = {
  login: string;
  email?: string;
};

type CacheEntry = { username: string; provider: string; cachedAt: number };
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export class ScmTokenCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  private key(provider: string, token: string): string {
    return crypto.createHash('sha512').update(`${provider}:${token}`).digest('hex');
  }

  lookup(provider: string, token: string): string | null {
    const k = this.key(provider, token);
    const entry = this.cache.get(k);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(k);
      return null;
    }
    return entry.username;
  }

  store(provider: string, token: string, username: string): void {
    this.cache.set(this.key(provider, token), { username, provider, cachedAt: Date.now() });
  }

  evictByUsername(provider: string, username: string): void {
    for (const [k, entry] of this.cache.entries()) {
      if (entry.username === username && entry.provider === provider) this.cache.delete(k);
    }
  }
}

export const scmTokenCache = new ScmTokenCache();

export interface TokenIdentityProvider {
  readonly name: string;
  matches(hostname: string): boolean;
  fetchScmIdentity(token: string): Promise<ScmUserInfo | null>;
}

type GitHubUserResponse = {
  login: string;
  id: number;
  email: string | null;
};

export class GitHubTokenIdentityProvider implements TokenIdentityProvider {
  readonly name = 'github';

  matches(hostname: string): boolean {
    return hostname === 'github.com';
  }

  async fetchScmIdentity(token: string): Promise<ScmUserInfo | null> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!response.ok) {
        console.warn(
          `GitHub /user API returned ${response.status} — token may be invalid or lack read:user scope`,
        );
        return null;
      }

      const user: GitHubUserResponse = await response.json();
      return {
        login: user.login,
        email: user.email ?? undefined,
      };
    } catch (e) {
      console.warn(`Failed to fetch GitHub identity: ${e}`);
      return null;
    }
  }
}

const providers: TokenIdentityProvider[] = [new GitHubTokenIdentityProvider()];

export function getProviderForHost(hostname: string): TokenIdentityProvider | null {
  return providers.find((p) => p.matches(hostname)) ?? null;
}
