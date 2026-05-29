# Git-Proxy v1.19.2 → v2.0.0 MongoDB migration

Operator prep for upgrade, aligned with [finos/git-proxy#1535](https://github.com/finos/git-proxy/issues/1535#issuecomment-4478956510) (these scripts do **not** replace your own DB backup/snapshot).
**Behavior:** dry-run by default for both phases; normalization is idempotent; email apply skips unchanged rows and checks uniqueness before writes; backups are explicit helper scripts plus your own infra.

| Phase | Scripts                               | Goal                                                                                                                                                                               |
| ----- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | `migrate-urls.js`, `backup-urls.js`   | **Repo URL normalization** — append `.git` to `repos.url` where missing (idempotent)                                                                                               |
| **2** | `migrate-users.js`, `backup-users.js` | **Email audit** (blocking issues) + optional **CSV apply**; **ACL audit** — list `canPush` / `canAuthorise` entries that do not resolve to any `User.username` (no silent rewrite) |

Env: `MONGO_URI`, `DB_NAME` (see `scripts/migrate/lib/config.js`). Reports: `reports/{date}-migration/`.

## npm scripts

```bash
npm run migrate:urls                        # repo URL normalization — dry-run
npm run backup:urls
npm run migrate:urls -- --apply              # apply normalization

npm run migrate:users                        # email + ACL audit (dry-run)
npm run backup:users
npm run migrate:users -- --apply --csv ./map.csv
```

---

## Phase 1 — Repo URL normalization (append `.git` where missing)

**Goal:** every `repos.url` that v2 will match must include the `.git` suffix where it is missing.

**Why:** v2 resolves repos by **exact** `url` via `getRepoByUrl`; v1 often relied on `name`. Incoming git HTTP traffic is normalized to a URL that includes `.git` (see `parseAction`), while legacy `repos` rows may have been stored without it. Those rows no longer match, so processors such as `checkRepoInAuthorisedList` treat the repo as unauthorized. (The admin UI already requires `.git` when creating new repositories.)

|              | v1.19.2      | v2.0.0                                     |
| ------------ | ------------ | ------------------------------------------ |
| Lookup       | `name`       | `url` (exact `$eq`)                        |
| `.git` in DB | not required | required for parity with incoming requests |

**Scripts:** `migrate-urls.js`, `backup-urls.js`; helpers under `lib/` (`analyze-urls.js`, `reporting.js`, `common.js`, `config.js`).

```bash
npm run migrate:urls
npm run backup:urls
npm run migrate:urls -- --apply
```

Notes: trailing `/` is normalized (`.../repo/` → `.../repo.git`). Blank/non-http(s) URLs are reported as issues and require manual fixing.

Reports: `report-{ts}.yaml`, `report-{ts}.csv` (pending changes), `url-issues-{ts}.csv` (manual fixes), `backup-urls-{ts}.json`.

---

## Phase 2 — User emails & ACL audit

**Goal:** unblock v2 pushes: valid **unique** `users.email` (audit + CSV apply fallback); surface **ACL orphan** `username` strings for manual UI fix.

**migrate-urls vs migrate-users**

|             | `migrate-urls.js`      | `migrate-users.js`              |
| ----------- | ---------------------- | ------------------------------- |
| Apply flags | `--apply`              | `--apply` **and** `--csv`       |
| Writes      | `repos.url` only       | `users.email` from CSV only     |
| Always      | normalization analysis | email audit + ACL orphan report |

`backup-users.js` is separate (not invoked by `migrate-users`) and writes a full JSON snapshot plus a `users-email-*.csv` template.

```bash
npm run migrate:users
npm run backup:users
npm run migrate:users -- --apply --csv ./mappings.csv
```

For **apply** (`migrate-users --apply --csv ...`): CSV header must be `username,email` (`lib/csv.js`). The command exits `1` on blocking email issues, ACL orphans, CSV/apply failures, or duplicate-email simulation.

CSV input: UTF‑8, one row per line, only those two columns; parser is minimal (quoted commas OK, **`""`** escapes inside fields not supported). Prefer export without BOM.

Extra CSVs when applicable: `users-audit-*.csv`, `acl-orphans-*.csv`, `email-changes-*.csv`.

---

## Pre-upgrade checklist

```bash
export MONGO_URI="mongodb://host:27017"
export DB_NAME="git_proxy"

# Phase 1 — repo URL normalization
npm run migrate:urls
npm run backup:urls
npm run migrate:urls -- --apply
npm run migrate:urls   # expect nothing left to normalize

# Phase 2 — email + ACL (timing vs app upgrade — your runbook)
npm run migrate:users
npm run backup:users
npm run migrate:users -- --apply --csv ./mappings.csv
```
