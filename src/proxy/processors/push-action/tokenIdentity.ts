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

import { getScmProviders } from '../../../config';
import { SCMProvider, SCMProviderType } from '../../../config/generated/config';

/**
 * What a credential resolved to: an account on a configured provider. This is
 * the one shape the rest of the proxy sees; the per-API response bodies below
 * are mapped into it and go no further.
 */
export type ScmIdentity = {
  provider: string;
  username: string;
};

/** `GET /user` on github.com, GHE.com tenants and GHES (`/api/v3`). */
export type GitHubUserEntity = { login: string; id: number };
/** `GET /api/v4/user` on gitlab.com and self-managed GitLab. */
export type GitLabUserEntity = { username: string; id: number };
/** `GET /api/v1/user` on Forgejo, Gitea and Codeberg. */
export type ForgejoUserEntity = { login: string; id: number };

/** The HTTP Basic credential git sent with the push. */
export type PushCredential = { username: string; token: string };

type CacheEntry = { identity: ScmIdentity; cachedAt: number };

// 7 days — PATs are rarely rotated more frequently than this in practice; the cache is a
// rate-limit optimization only (keys are one-way SHA-512 hashes, not recoverable tokens).
// It remembers which SCM account a token belongs to. Which git-proxy user that account
// is linked to is looked up on every push, so relinking takes effect immediately.
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const IDENTITY_TIMEOUT_MS = 5000;

export class ScmTokenCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  private key(provider: string, credential: PushCredential): string {
    return crypto
      .createHash('sha512')
      .update(`${provider}:${credential.username}:${credential.token}`)
      .digest('hex');
  }

  /** SCM account a credential previously resolved to, or null. */
  lookup(provider: string, credential: PushCredential): ScmIdentity | null {
    const k = this.key(provider, credential);
    const entry = this.cache.get(k);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(k);
      return null;
    }
    entry.cachedAt = Date.now();
    return entry.identity;
  }

  store(provider: string, credential: PushCredential, identity: ScmIdentity): void {
    this.cache.set(this.key(provider, credential), { identity, cachedAt: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const scmTokenCache = new ScmTokenCache();

export interface TokenIdentityProvider {
  /** Configured name; the key under which users link this account. */
  readonly name: string;
  readonly type: SCMProviderType;
  readonly host: string;
  readonly apiUrl: string;
  matches(hostname: string): boolean;
  /**
   * Ask the host who the credential belongs to.
   * @param credential the Basic credential git sent
   */
  fetchScmIdentity(credential: PushCredential): Promise<ScmIdentity | null>;
}

/**
 * Hosts with a built-in provider. Any other host has to be listed under
 * `scmProviders` in the proxy configuration before pushes to it can be attributed.
 */
export const DEFAULT_SCM_PROVIDERS: SCMProvider[] = [
  { name: 'github', type: SCMProviderType.Github, host: 'github.com' },
  { name: 'gitlab', type: SCMProviderType.Gitlab, host: 'gitlab.com' },
  { name: 'codeberg', type: SCMProviderType.Forgejo, host: 'codeberg.org' },
  { name: 'gitea', type: SCMProviderType.Forgejo, host: 'gitea.com' },
];

/**
 * Where the REST API for a host lives. GitHub has three shapes (github.com,
 * data-residency tenants on *.ghe.com, and GHES under /api/v3); GitLab and
 * Forgejo-family hosts serve their API under a fixed path on the same host.
 * @param {SCMProvider} provider provider configuration
 * @return {string} API base URL without a trailing slash
 */
export function apiBaseUrl(provider: SCMProvider): string {
  if (provider.apiUrl) return provider.apiUrl.replace(/\/+$/, '');
  const host = provider.host.toLowerCase();
  switch (provider.type) {
    case SCMProviderType.Github:
      if (host === 'github.com') return 'https://api.github.com';
      if (host.endsWith('.ghe.com')) return `https://api.${host}`;
      return `https://${host}/api/v3`;
    case SCMProviderType.Gitlab:
      return `https://${host}/api/v4`;
    case SCMProviderType.Forgejo:
      return `https://${host}/api/v1`;
  }
}

type UserEndpoint = {
  /** Authorization scheme the API accepts a personal access token under. */
  scheme: string;
  /** Pull the account handle out of the response body, or null if it is not there. */
  toUsername: (body: unknown) => string | null;
};

const nonEmpty = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

// GitHub and Forgejo accept a PAT as `token <pat>`; GitLab wants `Bearer`.
const USER_ENDPOINTS: Partial<Record<SCMProviderType, UserEndpoint>> = {
  [SCMProviderType.Github]: {
    scheme: 'token',
    toUsername: (body) => nonEmpty((body as Partial<GitHubUserEntity>)?.login),
  },
  [SCMProviderType.Forgejo]: {
    scheme: 'token',
    toUsername: (body) => nonEmpty((body as Partial<ForgejoUserEntity>)?.login),
  },
  [SCMProviderType.Gitlab]: {
    scheme: 'Bearer',
    toUsername: (body) => nonEmpty((body as Partial<GitLabUserEntity>)?.username),
  },
};

export class HttpTokenIdentityProvider implements TokenIdentityProvider {
  readonly name: string;
  readonly type: SCMProviderType;
  readonly host: string;
  readonly apiUrl: string;

  constructor(config: SCMProvider) {
    this.name = config.name;
    this.type = config.type;
    this.host = config.host.toLowerCase();
    this.apiUrl = apiBaseUrl(config);
  }

  matches(hostname: string): boolean {
    return hostname.toLowerCase() === this.host;
  }

  async fetchScmIdentity(credential: PushCredential): Promise<ScmIdentity | null> {
    const endpoint = USER_ENDPOINTS[this.type];
    if (!endpoint) return null;
    const url = `${this.apiUrl}/user`;
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `${endpoint.scheme} ${credential.token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(IDENTITY_TIMEOUT_MS),
      });

      if (!response.ok) {
        console.warn(
          `${this.name}: ${url} returned ${response.status} — token may be invalid or lack the read-user scope`,
        );
        return null;
      }

      const username = endpoint.toUsername(await response.json());
      if (!username) {
        console.warn(`${this.name}: ${url} response did not name the token owner`);
        return null;
      }
      return { provider: this.name, username };
    } catch (e) {
      console.warn(`${this.name}: failed to fetch identity from ${url}: ${e}`);
      return null;
    }
  }
}

/**
 * Build providers from configuration, falling back to the built-in hosts when
 * none are configured.
 * @param {SCMProvider[]} configs configured providers
 * @return {TokenIdentityProvider[]} providers in configuration order
 */
export function createProviders(configs: SCMProvider[]): TokenIdentityProvider[] {
  const source = configs.length ? configs : DEFAULT_SCM_PROVIDERS;
  return source.map((c) => new HttpTokenIdentityProvider(c));
}

let providers: TokenIdentityProvider[] | null = null;
let providersSource: SCMProvider[] | null = null;

// Configuration can be (re)loaded after this module is imported, for example when
// the config file is set from the command line at startup, so the provider list is
// rebuilt whenever the configured list is a different object than the one it was
// built from.
const loadProviders = (): TokenIdentityProvider[] => {
  const source = getScmProviders();
  if (!providers || source !== providersSource) {
    providers = createProviders(source);
    providersSource = source;
  }
  return providers;
};

export function getProviders(): TokenIdentityProvider[] {
  return loadProviders();
}

export function getProviderForHost(hostname: string): TokenIdentityProvider | null {
  return loadProviders().find((p) => p.matches(hostname)) ?? null;
}

export function getProviderByName(name: string): TokenIdentityProvider | null {
  return loadProviders().find((p) => p.name === name) ?? null;
}

/** Drop the provider list so the next call rebuilds it from configuration. Test hook. */
export function resetProviders(): void {
  providers = null;
  providersSource = null;
}
