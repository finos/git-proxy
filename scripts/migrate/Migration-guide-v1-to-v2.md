# Git-Proxy v1.19.2 → v2.0.0 migration (MongoDB or file DB)

Operator prep for upgrade, aligned with [finos/git-proxy#1535](https://github.com/finos/git-proxy/issues/1535#issuecomment-4478956510) (these scripts do **not** replace your own DB backup/snapshot).
**Behavior:** dry-run by default for both phases; normalization is idempotent; email apply skips unchanged rows and checks uniqueness before writes; backups are explicit helper scripts plus your own infra.

| Phase | Scripts                               | Goal                                                                                                                                                                               |
| ----- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | `migrate-urls.js`, `backup-urls.js`   | **Repo URL normalization** — append `.git` to `repos.url` where missing (idempotent)                                                                                               |
| **2** | `migrate-users.js`, `backup-users.js` | **Email audit** (blocking issues) + optional **CSV apply**; **ACL audit** — list `canPush` / `canAuthorise` entries that do not resolve to any `User.username` (no silent rewrite) |

Configuration: `scripts/migrate/lib/config.js` and `scripts/migrate/lib/datastore.js`. Report file names and contents: [Report artifacts](#report-artifacts) below.

## npm scripts

```bash
npm run backup:urls
npm run migrate:urls                        # repo URL normalization — dry-run
npm run migrate:urls -- --apply              # apply normalization

npm run backup:users
npm run migrate:users                        # email + ACL audit (dry-run)
npm run migrate:users -- --apply --csv ./map.csv
```

Equivalent: `node scripts/migrate/<script>.js` from the repository root (same env vars).

Optional local env file (example): `scripts/migrate/envs/local.env`

```bash
set -a && source scripts/migrate/envs/local.env && set +a
npm run migrate:users
```

---

## Database backend (`--dbType`)

All scripts connect through `scripts/migrate/lib/datastore.js`.

| Backend     | `--dbType` | When used                                         |
| ----------- | ---------- | ------------------------------------------------- |
| MongoDB     | `mongo`    | **Default** if `--dbType` and `DB_TYPE` are unset |
| File (neDB) | `fs`       | Explicit: `--dbType fs` or `DB_TYPE=fs`           |

Priority: CLI `--dbType` → env `DB_TYPE` → `mongo` (no auto-detection).

Collections / files: `users`, `repos`.

---

## Environment variables

| Variable        | Required | Default                          | Purpose                                            |
| --------------- | -------- | -------------------------------- | -------------------------------------------------- |
| `MONGO_URI`     | no       | `mongodb://localhost:27017`      | MongoDB connection string (`dbType=mongo`)         |
| `DB_NAME`       | no       | `git-proxy`                      | MongoDB database name                              |
| `DB_TYPE`       | no       | `mongo`                          | Backend: `mongo` or `fs`                           |
| `USERS_DB_PATH` | no       | `./.data/db/users.db`            | neDB users file (`dbType=fs`), relative to **cwd** |
| `REPOS_DB_PATH` | no       | `./.data/db/repos.db`            | neDB repos file (`dbType=fs`), relative to **cwd** |
| `REPORTS_DIR`   | no       | `reports/<YYYY-MM-DD>-migration` | Directory where report files are written           |

CLI overrides (same priority as above for connection): `--mongoUri`, `--dbName`, `--usersDbPath`, `--reposDbPath`.

When `REPORTS_DIR` is set, it is used **as the full output directory** (the dated `reports/<date>-migration` subpath is **not** appended). When unset, reports go under `reports/<today>-migration/` relative to the process working directory.

```bash
# MongoDB (default)
export MONGO_URI="mongodb://host:27017"
export DB_NAME="git-proxy"
export REPORTS_DIR="/var/git-proxy/migration-run-1"   # optional

# File DB
export DB_TYPE=fs
export USERS_DB_PATH="./.data/db/users.db"
export REPOS_DB_PATH="./.data/db/repos.db"
```

---

## Report artifacts

Reports are **action-oriented**: YAML/CSV list repos or users that need migration, manual URL fixes, email fixes, or ACL fixes. Repos/users already OK appear only as **counts** in YAML (for example `reposAlreadyFixed`), not as full row lists. This is not a full-database export (use `mongodump` or `backup-users` for users).

### Always written (when the script reaches report generation)

| File                      | Written by                                     |
| ------------------------- | ---------------------------------------------- |
| `report-{timestamp}.yaml` | `migrate-urls`, `backup-urls`, `migrate-users` |

### Conditional CSV / JSON (created only if the relevant list is non-empty)

| File                            | Written by                    | Condition                          |
| ------------------------------- | ----------------------------- | ---------------------------------- |
| `report-{timestamp}.csv`        | `migrate-urls`, `backup-urls` | `changes.length > 0` (URL pending) |
| `url-issues-{timestamp}.csv`    | `migrate-urls`, `backup-urls` | `issues.length > 0` (manual URL)   |
| `users-audit-{timestamp}.csv`   | `migrate-users`               | blocking email `users.issues`      |
| `acl-orphans-{timestamp}.csv`   | `migrate-users`               | `acl.orphans.length > 0`           |
| `email-changes-{timestamp}.csv` | `migrate-users` (--apply)     | `apply.changes.length > 0`         |
| `backup-urls-{timestamp}.json`  | `backup-urls` only            | see backup-urls below              |

### Backup-only extras

| File                            | Written by     | Contents                                                 |
| ------------------------------- | -------------- | -------------------------------------------------------- |
| `backup-users-{timestamp}.json` | `backup-users` | **All** users (password field excluded)                  |
| `users-email-{timestamp}.csv`   | `backup-users` | **All** users as `username,email` template for CSV apply |

`backup-urls` does **not** dump every repo: the JSON array contains only documents that appear in `changes` (missing `.git`) or `issues` (blank / unsupported URL), each with `backupReason` metadata. If nothing needs migration and there are no URL issues, **no** `backup-urls-*.json` is created and the script exits 0.

CSV validation errors from `--apply --csv` are recorded in YAML (`report.csv.errors`); there is no separate `csv-errors-*.csv`.

### YAML contents (summary)

**Phase 1** (`migrate-urls`, `backup-urls`): `totalRepos`, `reposNeedingUpdate`, `reposAlreadyFixed`, `changes[]` (repos to append `.git`), `issues[]` (manual fix), `issueCount`. After `--apply`: may include `reposUpdated`, `errors`, and `changes[].status` (`updated` / `error` / …). `backup-urls` sets `mode: backup-only`.

**Phase 2** (`migrate-users`): nested structure:

- `mode`: `dry-run` or `apply`
- `users`: audit (`totalUsers`, `counts`, `issues`, `duplicateGroups`, `blockingIssueCount`, …)
- `acl`: `orphanCount`, `orphans[]` (entries in `repos.users.canPush` / `canAuthorise` with no matching `users.username`)
- `apply`: present on `--apply` (`ok`, `reason`, `changes`, `conflicts`, …)
- `csv`: present on `--apply` (`path`, `rowCount`, `errors`)

### Exit codes

| Script          | Exit 0 when                                                                                      | Exit 1 when                    |
| --------------- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| `migrate-urls`  | no apply errors and no URL issues                                                                | URL issues and/or apply errors |
| `migrate-users` | no blocking email issues, no ACL orphans, apply OK, no post-apply email conflicts, no CSV errors | any of the above fail          |
| `backup-urls`   | always (including “nothing to backup”)                                                           | fatal error only               |
| `backup-users`  | success                                                                                          | fatal error only               |

After a successful URL apply, a follow-up dry-run should show `reposNeedingUpdate: 0`, but exit code is still **1** if URL **issues** remain (blank or non-http(s) URLs).

### Read-only issue reports (manual fix in the database)

Some CSV files are **audit output only** — no migration script reads them back as input:

| File                | Meaning                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `url-issues-*.csv`  | Repos whose `url` is blank or not `http`/`https` — fix in the DB, then re-run `migrate:urls`                     |
| `acl-orphans-*.csv` | Repo ACL entries whose username does not match any `users.username` — fix in the DB, then re-run `migrate:users` |

Only `migrate-users --apply --csv` consumes a CSV (`username,email` for `users.email`). `email-changes-*.csv` is an apply **log**, not a re-import format.

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

Notes: trailing `/` is normalized (`.../repo/` → `.../repo.git`). Blank/non-http(s) URLs are reported as issues and require **manual** correction in the database; `url-issues-*.csv` is a checklist only (see [Read-only issue reports](#read-only-issue-reports-manual-fix-in-the-database)).

Phase 1 report files: see [Report artifacts](#report-artifacts) (`report-*.yaml`, `report-*.csv`, `url-issues-*.csv`, `backup-urls-*.json`).

---

## Phase 2 — User emails & ACL audit

**Goal:** unblock v2 pushes: valid **unique** `users.email` (audit + CSV apply fallback); surface **ACL orphan** entries that must be corrected **manually** in the database (scripts never rewrite repo ACL).

**migrate-urls vs migrate-users**

|             | `migrate-urls.js`      | `migrate-users.js`              |
| ----------- | ---------------------- | ------------------------------- |
| Apply flags | `--apply`              | `--apply` **and** `--csv`       |
| Writes      | `repos.url` only       | `users.email` from CSV only     |
| Always      | normalization analysis | email audit + ACL orphan report |

`backup-users.js` is separate (not invoked by `migrate-users`) and writes a **full** users JSON snapshot plus `users-email-*.csv` for all users (see [Report artifacts](#report-artifacts)).

### Recommended order (emails → ACL → verify)

1. **Emails** — run `npm run migrate:users` (dry-run). Resolve every blocking row in `users-audit-*.csv` / YAML `users.issues` (missing/invalid/duplicate email). Where CSV apply is appropriate, run `npm run migrate:users -- --apply --csv ./mappings.csv` and confirm `apply.ok` in the report.
2. **ACL orphans** — while `acl.orphanCount` (console: `ACL orphans`) is greater than zero, fix each orphan listed in `acl-orphans-*.csv` or YAML `acl.orphans` in the database. Migration tools **do not** update `repos.users.canPush` or `repos.users.canAuthorise`.
3. **Verify** — run `npm run migrate:users` (dry-run) again after each batch of fixes. Phase 2 is complete only when `blockingIssueCount` is **0**, `orphanCount` is **0**, and the process exits **0** (see [Exit codes](#exit-codes)).

```bash
npm run migrate:users
npm run backup:users
npm run migrate:users -- --apply --csv ./mappings.csv
# … manual ACL fixes in the database …
npm run migrate:users   # repeat until ACL orphans: 0 and exit 0
```

### ACL orphans (manual fix required)

An **orphan** is a username string stored under a repo’s `users.canPush` or `users.canAuthorise` that does not match any document in `users` (match is trimmed, case-insensitive on `username`). These stale or mistyped ACL entries keep `migrate-users` in a failing state until they are removed or aligned with a real user record.

`acl-orphans-{timestamp}.csv` columns: `RepoID`, `RepoName`, `RepoURL`, `Field` (`canPush` / `canAuthorise`), `OrphanUsername`, `NormalizedOrphan`, `Index`. Like `url-issues-*.csv`, this file is **read-only** — it cannot be “loaded back” or applied by any script; use it as a work list, fix data in your environment, then re-run the dry-run (see [Read-only issue reports](#read-only-issue-reports-manual-fix-in-the-database)).

For **apply** (`migrate-users --apply --csv ...`): CSV header must be `username,email` (`lib/csv.js`). The command exits `1` on blocking email issues, ACL orphans, CSV/apply failures, or duplicate-email simulation (see [Exit codes](#exit-codes)).

CSV input: UTF‑8, one row per line, only those two columns; parser is minimal (quoted commas OK, **`""`** escapes inside fields not supported). Prefer export without BOM.

Phase 2 report files (when applicable): `users-audit-*.csv`, `acl-orphans-*.csv`, `email-changes-*.csv`, plus `report-*.yaml` (full nested report).

---

## Pre-upgrade checklist

```bash
export MONGO_URI="mongodb://host:27017"
export DB_NAME="git-proxy"

# Phase 1 — repo URL normalization
npm run migrate:urls
npm run backup:urls
npm run migrate:urls -- --apply
npm run migrate:urls   # expect reposNeedingUpdate: 0; exit 1 if URL issues remain

# Phase 2 — email + ACL (timing vs app upgrade — your runbook)
npm run migrate:users
npm run backup:users
npm run migrate:users -- --apply --csv ./mappings.csv
# fix ACL orphans manually (acl-orphans-*.csv is not re-importable)
npm run migrate:users   # repeat until orphanCount: 0 and exit 0
```
