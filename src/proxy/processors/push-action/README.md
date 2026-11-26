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
    "maxSizeGB": 10,
    "maxRepositories": 50,
    "cacheDir": "./.repo-cache",
    "gitTimeoutSeconds": 3600
  }
}
```

| Option              | Default         | Meaning                                         |
| ------------------- | --------------- | ----------------------------------------------- |
| `enabled`           | `false`         | Use the cached pull implementations             |
| `maxSizeGB`         | `10`            | Total size above which LRU eviction kicks in    |
| `maxRepositories`   | `50`            | Number of mirrors above which eviction kicks in |
| `cacheDir`          | `./.repo-cache` | Where the bare mirrors live                     |
| `gitTimeoutSeconds` | `3600`          | Kill a git command and fail the push after this |

## How a cached pull works

`createPullRemote()` returns `PullRemoteHTTPSCached` or `PullRemoteSSHCached` when the cache is enabled. Both only override `performClone()`: they build a protocol-specific `RemoteAccess` (Basic credentials for HTTPS, a `GIT_SSH_COMMAND` pointing at the forwarded agent for SSH) and hand it to `performCachedClone()` in [`cachedClone.ts`](./cachedClone.ts).

### Phase 1 - bare mirror

The mirror lives at `<cacheDir>/<host>__<project>__<repo>-<hash>`, e.g. `github.com__finos__git-proxy.git-<sha256>`, so the same repository name on different hosts or projects never shares a mirror. The hash is taken from the unsanitised host, project and repository, so paths that sanitise to the same name (GitLab `a/b/c` and `a-b/c`) stay apart. The readable part is cut to 64 characters to keep paths short; the full SHA-256 keeps keys unique.

- **Miss**: the remote is cloned with `git clone --bare` (full history, all branches and tags).
- **Hit**: the mirror is updated with `git fetch --prune` of `refs/heads/*` and `refs/tags/*`.
- **Fetch fails, mirror readable**: the error came from the remote side (network, wrong credentials, no access, timeout), so the push fails and the mirror is kept. No re-clone is attempted.
- **Fetch fails, mirror corrupted** (git can no longer read its refs): the mirror is rebuilt. If the rebuild also fails the push fails and **the existing mirror is left untouched**.

Git commands on the mirror use `--git-dir`, so a broken mirror inside another repository (such as the GitProxy checkout around `./.repo-cache`) is never mistaken for that repository.

Every clone into the cache is done in a dot-prefixed staging folder (`.staging-<key>-<uuid>`) and only moved into place once it succeeded, so a failed or interrupted clone never leaves a half-written mirror behind. Staging folders are ignored by the cache statistics and by eviction, and leftovers from a crash are removed at startup.

The cache lives outside `./.remote`, which GitProxy empties on every start, so the mirrors survive restarts. A `cacheDir` configured inside `./.remote` logs a warning at startup.

Every push still talks to the remote with **its own** credentials, so the cache never lets a client read a repository it could not clone itself.

### Phase 2 - working copy

`git clone <mirror> <proxyGitPath>/<repo>` creates the working copy used by the rest of the chain. This is a local clone (no network). The working copy is deleted by `clearBareClone` as before; the mirror stays.

## Concurrency

`CacheManager.withRepositoryLock(key, fn)` serialises all work on one mirror: concurrent pushes to the same repository fetch / rebuild / clone one after the other, while pushes to different repositories run in parallel. A repository that is locked, or waited for, is never evicted.

The global `CacheManager` mutex additionally serialises `touchRepository()` and `enforceLimits()`.

> The locks are in-process. Several GitProxy instances must not share the same `cacheDir`.

All git commands are run with an asynchronous `spawn`, so a long clone never blocks the event loop. Each command is killed after `cache.gitTimeoutSeconds`, together with its helper processes (`SIGTERM`, then `SIGKILL` after 5 s), so a hung fetch fails its push and releases the lock instead of blocking every later push to that repository. The push only fails once every git process has exited.

## Credentials

HTTPS credentials are never put on the command line or in a URL. [`git-operations.ts`](./git-operations.ts) passes them to git through `GIT_CONFIG_*` environment variables as an `http.<origin>/.extraHeader` Authorization header, and resets `credential.helper` so a rejected token can never fall back to credentials stored on the proxy host. `GIT_TERMINAL_PROMPT=0` makes git fail instead of waiting for input.

Git also runs isolated from the proxy host's git configuration, like isomorphic-git on the uncached path: `GIT_CONFIG_NOSYSTEM=1` skips `/etc/gitconfig` and `HOME` points to an empty folder, so `~/.gitconfig`, `~/.config/git/config` and `~/.netrc` are never read. An `extraHeader` or `insteadOf` set on the host therefore never applies to a client's clone. Set an HTTP proxy or a custom CA through `HTTPS_PROXY` / `GIT_SSL_CAINFO` instead. This requires git 2.31 or later, which GitProxy checks at startup when the cache is enabled.

## Eviction

After each cached pull, `enforceLimits()` removes the least recently used mirrors (by the folder's mtime, which `touchRepository()` updates) until both limits are respected. Mirror sizes are kept in memory: each push only re-measures the mirror it updated. The mirror the current push just used is always kept: a repository larger than `maxSizeGB` therefore stays cached and a warning is logged on the push; it is evicted once another repository becomes more recent.

## Performance

`pullRemote` step for a one-commit push to backstage/backstage (8.7 GB pack), against a local smart-HTTP server, medians of 3 runs (the miss ran once) ([full benchmark](https://gist.github.com/jescalada/9c0e93aec698cc5a73f3f53c2de9b3ff)):

| Metric                       | Without cache | Cache miss (first push) | Cache hit  |
| ---------------------------- | ------------- | ----------------------- | ---------- |
| **Duration**                 | 145 s         | 776 s                   | **6.4 s**  |
| **Longest event-loop stall** | 9,040 ms      | 88 ms                   | **75 ms**  |
| **Peak memory (RSS)**        | 3,353 MB      | 97 MB                   | **102 MB** |

The first push of a repository is slower than without the cache, because the mirror holds the full history while the uncached path makes a shallow (`depth: 1`) clone. Every later push only fetches the new commits. Results depend on network conditions and repository size.

## Tests

- `test/processors/cachedClone.test.ts` - cache keys, miss/hit/rebuild, concurrency, eviction, both cached pull classes; runs offline against a local bare remote
- `test/processors/cacheManager.test.ts` - stats, LRU eviction, locks
- `test/processors/gitOperations.test.ts` - git argv/env, credential handling, error paths
- `test/processors/hybridCache.integration.test.ts` - end-to-end against github.com, only with `RUN_NETWORK_TESTS=true`
