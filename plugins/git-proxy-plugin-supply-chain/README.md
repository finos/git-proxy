# @finos/git-proxy-plugin-supply-chain

A GitProxy **push** plugin that flags common software-supply-chain-attack signatures in
dependency manifests as they are pushed, and surfaces them in the push review flow.

Supply-chain attacks (e.g. a poisoned `postinstall` script, a typosquatted dependency, or a
dependency swapped to a git/tarball source) enter an organisation's repositories via a **push**.
GitProxy already gates every push through review, so this plugin adds a scan of the changed
dependency files and attaches its findings to that review.

## What it checks (npm)

On any push that changes `package.json`, `package-lock.json`, `npm-shrinkwrap.json`,
`yarn.lock` or `pnpm-lock.yaml`:

- **Install lifecycle scripts** - added/modified `preinstall`, `install`, `postinstall`,
  `prepare` (and other lifecycle scripts). Scripts whose content looks dangerous
  (`curl … | sh`, `eval(`, `base64 -d`, `node -e`, `child_process`, raw IPs, install-time
  network access) are escalated.
- **Non-registry dependency sources** - dependencies resolving from git URLs, http(s)
  tarballs, `file:`/local paths, or npm aliases.
- **Typosquats** - newly-added dependencies whose names are a tiny edit distance from a popular
  package (offline reference list in `lib/data/npm-popular.js`).
- **Unpinned versions** - dependencies switched to `*`, `latest`, `x`, or `>=0`.
- **Lockfile sources** - newly-introduced `resolved`/`tarball` URLs that point at a git source,
  plain http, or an unexpected registry host.

Findings are compared against the pre-push version of each file, so unchanged content is not
re-flagged.

## What it checks (Python)

On any push that changes `requirements*.txt`, `pyproject.toml`, `setup.py`, `setup.cfg`,
`Pipfile`, `poetry.lock` or `Pipfile.lock`:

- **setup.py execution** - `setup.py` runs arbitrary code at install/build time; any change is
  flagged, escalated when the added lines call `os.system`/`subprocess`, `eval`/`exec`,
  `__import__`, network APIs, base64 decoding, or reference a raw IP.
- **Custom indexes** - `--index-url`/`--extra-index-url` in requirements and
  `[[tool.poetry.source]]`/`[[source]]` blocks (dependency-confusion risk).
- **Non-registry sources** - vcs/url/editable requirements, poetry/pipenv inline `git`/`url`/`path`
  sources, and PEP 508 direct-URL references (`pkg @ https://...`).
- **Unpinned requirements** and **typosquats** (offline PyPI reference list).
- **Lockfile sources** - git or plain-http package sources newly introduced in `poetry.lock` /
  `Pipfile.lock`.

## What it checks (Go)

On any push that changes `go.mod` or `go.sum`:

- **Replace directives** - local filesystem paths (HIGH) and remote redirects to a different
  module path (HIGH).
- **Suspicious hosts** - raw IPv4 module hosts (CRITICAL), plus `localhost` or `http://` module
  paths (HIGH).
- **Version signals** - pseudo-versions (LOW) and `+incompatible` versions (INFO) on newly-added
  require entries.
- **Toolchain directives** - added or changed `toolchain` values (MEDIUM on changed files, INFO
  on fresh-file scans).
- **Exclude entries** - newly-added `exclude` directives (INFO).
- **Typosquats** - newly-added module paths compared with the offline list in
  `lib/data/go-popular.js` (HIGH).
- **go.sum suspicious hosts** - newly-added lockfile lines whose module host is raw IPv4,
  `localhost`, or contains `http://`.

`vendor/modules.txt` is not scanned.

> Coverage is npm + Python + Go today; Cargo, RubyGems and others are planned - each is a new
> module under `lib/ecosystems/` plus an entry in `lib/manifests.js`; the plugin wiring is shared.

## How it runs

The plugin is constructed with `chainPhase: 'afterDiff'`, a GitProxy plugin option that runs the
plugin **after** the built-in `getDiff` step. At that point GitProxy has cloned the remote and
written the incoming pack, so the plugin reads the exact post-push content of each changed
manifest with `git show <newCommit>:<path>` and diffs it against `git show <oldCommit>:<path>`.

## Pull / clone protection

The plugin also scans repositories **as they are cloned/fetched through the proxy**, so a developer
is warned - or the clone is blocked - before pulling a poisoned repository. On a
`git clone`/`fetch`, the plugin (running once the repo is confirmed authorised) shallow-clones the
default branch, enumerates its manifests (`git ls-tree`) and scans them with the same
npm/Python/Go analyzers, treating the whole tree as newly introduced.

- **Warn (default):** findings are logged server-side and the clone proceeds.
- **Block (`pull.failOn` set):** a clone whose highest finding meets/exceeds the threshold **fails**,
  with the findings shown in the developer's terminal (`remote:` lines).

Scope / limitations of the current slice: **HTTPS only** (SSH pulls are skipped); the **default
branch** is scanned (not an arbitrarily requested ref); terminal-visible _warnings_ (non-blocking)
are a follow-up - today, warnings are logged and only _blocks_ reach the terminal.

## Enable it

Add the plugin to the `plugins` array in your `proxy.config.json`. GitProxy's plugin loader
takes only the **default export** of each configured module, so the push scanner (`index.js`)
and the pull/clone scanner (`pull.js`) are registered as two entries:

```json
{
  "plugins": [
    "@finos/git-proxy-plugin-supply-chain",
    "@finos/git-proxy-plugin-supply-chain/pull.js"
  ]
}
```

or, from a checkout of this repo:

```json
{
  "plugins": [
    "./plugins/git-proxy-plugin-supply-chain/index.js",
    "./plugins/git-proxy-plugin-supply-chain/pull.js"
  ]
}
```

## Configure it

By default the plugin is **non-blocking**: findings are attached to the push's review dashboard
step timeline, and the push proceeds through the normal approval flow.

Set the `GIT_PROXY_SUPPLY_CHAIN_CONFIG` environment variable to a JSON file to override defaults:

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

- `failOn` - `"off"` (default, annotate only) | `"low"` | `"medium"` | `"high"` | `"critical"`.
  When set, a push whose highest finding severity meets/exceeds the threshold is **blocked**
  (returned as an error to the pusher's terminal).
- `allowPackages` - package names and Go module paths to exempt from typosquat/new-dependency
  flags. For Go, use full module paths such as `github.com/stretchr/testify`.
- `npmRegistryHosts` - registry hosts treated as "expected" for lockfile source checks.
- `pull.enabled` - turn pull/clone scanning on or off.
- `pull.failOn` - block threshold for clones (same scale as `failOn`; default `"off"` = warn-only).

## License

Apache-2.0
