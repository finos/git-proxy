# Hybrid Cache Architecture

## Overview

The hybrid cache speeds up the `pullRemote` step by splitting the clone into two layers:

1. **Bare mirror** (persistent, shared) - one bare repository per upstream repository, kept in `cache.cacheDir`
2. **Working copy** (temporary, isolated) - the usual per-push checkout in `.remote/<hash of action id>/`, cloned locally from the mirror

The cache is **opt-in**. With `cache.enabled: false` (the default) `pullRemote` uses the original `PullRemoteHTTPS` / `PullRemoteSSH` implementations unchanged.

## Configuration

In `proxy.config.json`:

```json
{
  "cache": {
    "enabled": true,
    "maxSizeGB": 2,
    "maxRepositories": 50,
    "cacheDir": "./.remote/cache"
  }
}
```

| Option            | Default           | Meaning                                         |
| ----------------- | ----------------- | ----------------------------------------------- |
| `enabled`         | `false`           | Use the cached pull implementations             |
| `maxSizeGB`       | `2`               | Total size above which LRU eviction kicks in    |
| `maxRepositories` | `50`              | Number of mirrors above which eviction kicks in |
| `cacheDir`        | `./.remote/cache` | Where the bare mirrors live                     |

## How a cached pull works

`createPullRemote()` returns `PullRemoteHTTPSCached` or `PullRemoteSSHCached` when the cache is enabled. Both only override `performClone()`: they build a protocol-specific `RemoteAccess` (Basic credentials for HTTPS, a `GIT_SSH_COMMAND` pointing at the forwarded agent for SSH) and hand it to `performCachedClone()` in [`cachedClone.ts`](./cachedClone.ts).

### Phase 1 - bare mirror

The mirror lives at `<cacheDir>/<host>__<project>__<repo>`, e.g. `github.com__finos__git-proxy.git`, so the same repository name on different hosts or projects never shares a mirror.

- **Miss**: the remote is cloned with `git clone --bare` (full history, all branches and tags).
- **Hit**: the mirror is updated with `git fetch --prune` of `refs/heads/*` and `refs/tags/*`.
- **Fetch fails**: the mirror is rebuilt. If the rebuild also fails (for example because the client's credentials are wrong) the push fails and **the existing mirror is left untouched** for everyone else.

Every clone into the cache is done in a dot-prefixed staging folder (`.staging-<key>-<uuid>`) and only moved into place once it succeeded, so a failed or interrupted clone never leaves a half-written mirror behind. Staging folders are ignored by the cache statistics and by eviction.

Every push still talks to the remote with **its own** credentials, so the cache never lets a client read a repository it could not clone itself.

### Phase 2 - working copy

`git clone <mirror> <proxyGitPath>/<repo>` creates the working copy used by the rest of the chain. This is a local clone (no network). The working copy is deleted by `clearBareClone` as before; the mirror stays.

## Concurrency

`CacheManager.withRepositoryLock(key, fn)` serialises all work on one mirror: concurrent pushes to the same repository fetch / rebuild / clone one after the other, while pushes to different repositories run in parallel. A repository that is locked, or waited for, is never evicted.

The global `CacheManager` mutex additionally serialises `touchRepository()` and `enforceLimits()`.

> The locks are in-process. Several GitProxy instances must not share the same `cacheDir`.

All git commands are run with an asynchronous `spawn`, so a long clone never blocks the event loop.

## Credentials

HTTPS credentials are never put on the command line or in a URL. [`git-operations.ts`](./git-operations.ts) passes them to git through `GIT_CONFIG_*` environment variables as an `http.<origin>/.extraHeader` Authorization header, and resets `credential.helper` so a rejected token can never fall back to credentials stored on the proxy host. `GIT_TERMINAL_PROMPT=0` makes git fail instead of waiting for input. This requires git 2.31 or later.

## Eviction

After each cached pull, `enforceLimits()` removes the least recently used mirrors (by the folder's mtime, which `touchRepository()` updates) until both limits are respected. The mirror the current push just used is always kept: a repository larger than `maxSizeGB` therefore stays cached and a warning is logged on the push; it is evicted once another repository becomes more recent.

## Performance

Measured with the Backstage repository (10 consecutive pushes: 1 cold + 9 warm) using [`scripts/cache-benchmark.sh`](../../../../scripts/cache-benchmark.sh):

| Metric              | Without cache | With cache | Improvement |
| ------------------- | ------------- | ---------- | ----------- |
| **Cold push**       | 20.63s        | 17.58s     | 1.2x faster |
| **Warm push (avg)** | 19.88s        | **6.68s**  | **3x**      |
| **Std deviation**   | 0.99s         | 0.19s      | 5x steadier |

Results depend on network conditions and repository size. Note that the cold push of a large repository downloads its full history, while the uncached path uses a shallow (`depth: 1`) clone.

```bash
./scripts/cache-benchmark.sh <owner/repo> [branch] [num_pushes]
```

You need push access to the repository used for the benchmark.

## Tests

- `test/processors/cachedClone.test.ts` - cache keys, miss/hit/rebuild, concurrency, eviction, both cached pull classes; runs offline against a local bare remote
- `test/processors/cacheManager.test.ts` - stats, LRU eviction, locks
- `test/processors/gitOperations.test.ts` - git argv/env, credential handling, error paths
- `test/processors/hybridCache.integration.test.ts` - end-to-end against github.com, only with `RUN_NETWORK_TESTS=true`
