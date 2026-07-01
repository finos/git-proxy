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

> Coverage is npm + Python today. Go, Cargo, RubyGems and others are planned - each is a new
> module under `lib/ecosystems/` plus an entry in `lib/manifests.js`; the plugin wiring is shared.

## How it runs

The plugin is constructed with `chainPhase: 'afterDiff'`, a GitProxy plugin option that runs the
plugin **after** the built-in `getDiff` step. At that point GitProxy has cloned the remote and
written the incoming pack, so the plugin reads the exact post-push content of each changed
manifest with `git show <newCommit>:<path>` and diffs it against `git show <oldCommit>:<path>`.

## Enable it

Add the plugin to the `plugins` array in your `proxy.config.json`:

```json
{
  "plugins": ["@finos/git-proxy-plugin-supply-chain"]
}
```

or, from a checkout of this repo:

```json
{
  "plugins": ["./plugins/git-proxy-plugin-supply-chain/index.js"]
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
  "ecosystems": { "npm": true },
  "typosquat": true,
  "allowPackages": [],
  "npmRegistryHosts": ["registry.npmjs.org"]
}
```

- `failOn` - `"off"` (default, annotate only) | `"low"` | `"medium"` | `"high"` | `"critical"`.
  When set, a push whose highest finding severity meets/exceeds the threshold is **blocked**
  (returned as an error to the pusher's terminal).
- `allowPackages` - package names to exempt from typosquat/new-dependency flags.
- `npmRegistryHosts` - registry hosts treated as "expected" for lockfile source checks.

## License

Apache-2.0
