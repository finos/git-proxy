# Hybrid Cache Architecture

## Overview

The hybrid cache architecture optimizes Git repository cloning by splitting the cache into two layers:

1. **Bare Cache** (persistent, shared) - Stores minimal Git data shared across all requests
2. **Working Copy** (temporary, isolated) - Per-request workspace for push validation

## How pullRemote Works

### Phase 1: Bare Cache (Persistent, Shared)

```typescript
const bareRepo = path.join(BARE_CACHE, action.repoName);

if (bareExists) {
  // CACHE HIT: Fast fetch to update existing bare repo
  await gitOps.fetch({
    dir: bareRepo,
    url: action.url,
    bare: true,
    depth: 1,
  });
  cacheManager.touchRepository(action.repoName); // Update LRU timestamp
} else {
  // CACHE MISS: Clone new bare repository
  await gitOps.clone({
    dir: bareRepo,
    url: action.url,
    bare: true,
    depth: 1,
  });
}
```

**Key Points:**

- Bare repositories contain only `.git` data (no working tree)
- Shared across all push requests for the same repository
- Uses LRU eviction based on `maxSizeGB` and `maxRepositories` limits
- `touchRepository()` updates access time for LRU tracking

### Phase 2: Working Copy (Temporary, Isolated)

```typescript
const workCopy = path.join(WORK_DIR, action.id);
const workCopyPath = path.join(workCopy, action.repoName);

// Fast local clone from bare cache
await gitOps.cloneLocal({
  sourceDir: bareRepo,
  targetDir: workCopyPath,
  depth: 1,
});

action.proxyGitPath = workCopy; // Used by subsequent processors
```

**Key Points:**

- Each push request gets an isolated working copy
- Cloned from local bare cache (fast, no network)
- Cleaned up after push validation completes

### Phase 3: Cache Management

```typescript
const evictionResult = await cacheManager.enforceLimits();
```

**CacheManager** uses LRU (Least Recently Used) eviction:

- Monitors total cache size and repository count
- Removes oldest repositories when limits are exceeded
- Thread-safe via mutex to prevent race conditions

## Performance Benchmarks

Real-world performance comparison using the Backstage repository (177MB cached bare repo with `depth: 1`).

### Benchmark Setup

- **Test Repository**: Backstage (medium-large repository, 177MB cached)
- **Test Method**: 10 consecutive push operations (1 cold + 9 warm)
- **Cache Configuration**: Bare repositories with `depth: 1` (shallow clone)
- **Benchmark Script**: [`cache-benchmark.sh`](../../../../scripts/cache-benchmark.sh)

### Results Comparison

| Metric              | Without Cache (main) | With Cache (PR) | Improvement          |
| ------------------- | -------------------- | --------------- | -------------------- |
| **Cold Push**       | 20.63s               | 17.58s          | 15% faster           |
| **Warm Push (avg)** | 19.88s               | **6.68s**       | **66% faster**       |
| **Warm Push (min)** | 18.37s               | 6.34s           | 65% faster           |
| **Warm Push (max)** | 21.22s               | 7.12s           | 66% faster           |
| **Std Deviation**   | 0.99s                | 0.19s           | 5x more consistent   |
| **Speedup Ratio**   | 1.03x                | **2.63x**       | **155% improvement** |

### Time Saved

**Without Cache (main branch)**:

- 9 warm pushes: 178.93s total
- Every push requires full GitHub clone

**With Cache (this PR)**:

- 9 warm pushes: 60.16s total
- **Time saved: 98.10s (1.6 minutes)**
- **Efficiency gain: 66%**

### Running the Benchmark

To reproduce these results with your own repository fork:

```bash
# Test with cache (this PR branch)
./cache-benchmark.sh owner/repo
```

**Example**:

```bash
./cache-benchmark.sh yourFork/backstage main 10
```

**Note**: Results may vary based on network conditions, GitHub server load, and repository size. The benchmark uses `depth: 1` for all git operations. You must have push access to the repository you're testing.

## Cache Configuration

In `proxy.config.json`:

```json
{
  "cache": {
    "maxSizeGB": 2, // Maximum total cache size
    "maxRepositories": 50, // Maximum number of cached repos
    "cacheDir": "./.remote/cache" // Bare cache location
  }
}
```

## Concurrency & Thread Safety

The `CacheManager` uses a Promise-based mutex to serialize cache operations:

```typescript
private mutex: Promise<void> = Promise.resolve();

async touchRepository(repoName: string): Promise<void> {
  return this.acquireLock(() => {
    // Atomic operation
  });
}

async enforceLimits(): Promise<{ removedRepos: string[]; freedBytes: number }> {
  return this.acquireLock(() => {
    // Atomic operation
  });
}
```

**Race Conditions Prevented:**

- Multiple `enforceLimits()` calls removing the same repository
- `touchRepository()` updating while `enforceLimits()` is removing
- `getCacheStats()` reading while repositories are being deleted

## Cleanup Strategy

**Bare Cache:**

- Cleaned via LRU eviction (oldest repositories removed first)
- Triggered after every push via `enforceLimits()`
- Respects `maxSizeGB` and `maxRepositories` limits

**Working Copies:**

- Automatically cleaned by `clearBareClone.ts` after push completes
- Each request's `action.id` directory is deleted
- No manual cleanup needed

## Monitoring & Debugging

**Cache Statistics:**

```typescript
const stats = cacheManager.getCacheStats();
console.log(`Total repos: ${stats.totalRepositories}`);
console.log(`Total size: ${stats.totalSizeBytes / (1024 * 1024)}MB`);
```

**LRU Eviction Logs:**

```typescript
const result = await cacheManager.enforceLimits();
console.log(`Evicted ${result.removedRepos.length} repositories`);
console.log(`Freed ${result.freedBytes / (1024 * 1024)}MB`);
```
