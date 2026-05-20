# Git-Proxy v1.19.2 → v2.0.0 MongoDB URL Migration

## Problem Overview

When upgrading from git-proxy v1.19.2 to v2.0.0, repositories stored without the `.git` suffix in MongoDB URLs will become inaccessible for push/pull operations.

### Root Cause

**v1.19.2 vs v2.0.0 repository lookup logic:**

| Aspect | v1.19.2 | v2.0.0 |
|--------|---------|--------|
| Lookup method | By repo `name` field | By repo `url` field |
| URL matching | Not used for requests | Exact `$eq` match required |
| URL normalization | None (backend) | None (backend) |
| Git suffix requirement | Not enforced (proxy handles it) | Enforced (exact match) |

### Why this breaks

In v1.19.2, repos were looked up by `name`, so URLs without `.git` still worked. In v2.0.0, repos are looked up by exact URL match, so any repo stored without `.git` will fail to match incoming requests that include `.git`.

## Migration scripts

Migration is split into modular, reusable components:

```
scripts/migrate/
├── migrate.js       # Dry-run and apply modes
├── backup.js        # Backup only
└── lib/
    ├── config.js
    ├── analyze.js
    ├── reporting.js
    └── common.js
```

### Prerequisites

- Node.js 22.13.1+ (as per git-proxy requirements)
- MongoDB connection string and database name
- Network access to MongoDB instance
- Write access to `reports/` directory for backup files

## Usage

These scripts are **one-time migration tools** and are optional to add to `package.json`. Run them directly with Node.js:

```bash
# 1. Preview what will change (dry-run)
node scripts/migrate/migrate.js

# 2. Create backup (optional but recommended)
node scripts/migrate/backup.js

# 3. Apply migration
node scripts/migrate/migrate.js --apply
```

**Alternative: Using npm scripts** (if added to package.json):

```bash
npm run migrate
npm run backup
npm run migrate -- --apply
```

## Reports

All reports are saved to `reports/{timestamp}-migration/` directory:
- `report-{timestamp}.yaml` - Human-readable summary
- `report-{timestamp}.csv` - Spreadsheet-compatible list
- `backup-{timestamp}.json` - Original data backup

## Pre-Upgrade Checklist

```bash
# Set MongoDB connection (if not already set)
export MONGO_URI="mongodb://your-host:27017"
export MONGO_DB_NAME="git-proxy"

# 1. Test migration locally (dry-run)
node scripts/migrate/migrate.js

# 2. Create backup
node scripts/migrate/backup.js

# 3. Review reports in reports/{timestamp}-migration/ directory

# 4. Apply migration
node scripts/migrate/migrate.js --apply

# 5. Verify migration completed
node scripts/migrate/migrate.js
# Should show: Repos needing update: 0

# 6. Upgrade git-proxy to v2.0.0
npm install
```

## Features

- **Dry-run by default** - No changes until explicitly applied
- **Backup mode** - Backup when requested
- **YAML/JSON reports** - Human-readable summaries
- **CSV exports** - Spreadsheet compatible
- **Idempotent** - Safe to run multiple times
- **Date-based tracking**
