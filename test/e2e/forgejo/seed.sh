#!/bin/sh
# Seeds the Compose Forgejo with the users, organisations and repositories the e2e suite expects.
#
# Runs as the `git-server-seed` service on every `up`, after Forgejo reports healthy. Every step is
# idempotent: a fresh volume gets the full fixture, an existing one is left alone, and the script exits
# 0 either way so a re-run is never a failure.
#
# Two tools, both already in the Forgejo image. Users come from the `forgejo` CLI, which writes to the
# database directly. Organisations, repositories and collaborators have no CLI equivalent and come from
# the REST API, called as the admin.
#
# No tokens are minted here. The tests issue their own from the passwords below through
# `POST /api/v1/users/{name}/tokens`, which Forgejo allows with plain basic auth, so nothing has to be
# handed between this script and the suite.
set -eu

FORGEJO_URL="https://git-server:8443"

# Site admin. Owns the orgs and repos. Deliberately NOT linked to a GitProxy user, so pushing as the
# admin exercises the "account not linked" path. Not called `admin`: Forgejo reserves that name.
ADMIN_USER="gitadmin"
ADMIN_PASSWORD="admin123"

# Linked to the GitProxy user of the same name by the push suite's setup.
TEST_USER="testuser"
TEST_PASSWORD="user123"

log() { echo "[forgejo-seed] $*"; }

# Creates a user. The CLI writes straight to sqlite, and the server holds the write lock for
# short stretches while it starts up, so only a lock error is retried; anything else fails at once.
create_user() {
  username="$1"
  password="$2"
  email="$3"
  shift 3
  attempt=1
  while :; do
    if out=$(forgejo admin user create --username "$username" --password "$password" \
      --email "$email" --must-change-password=false "$@" 2>&1); then
      log "created user $username"
      return 0
    fi
    case "$out" in
      *"already exists"*)
        log "user $username already present"
        return 0
        ;;
      *"database is locked"* | *"SQLITE_BUSY"*) ;;
      *)
        log "ERROR: could not create $username: $out"
        return 1
        ;;
    esac
    if [ "$attempt" -ge 10 ]; then
      log "ERROR: could not create $username after $attempt attempts: $out"
      return 1
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
}

# Calls the API as the admin. 422 (org) and 409 (repository) mean "already exists" and count as success.
api() {
  method="$1"
  path="$2"
  body="$3"
  status=$(curl -sk -o /dev/null -w '%{http_code}' -u "${ADMIN_USER}:${ADMIN_PASSWORD}" \
    -H 'Content-Type: application/json' -X "$method" -d "$body" "${FORGEJO_URL}/api/v1/${path}")
  case "$status" in
    2*) log "${method} ${path} ok" ;;
    422 | 409) : ;;
    *) log "WARNING: ${method} ${path} returned ${status}" ;;
  esac
}

log "seeding ${FORGEJO_URL}"

# The admin first: every API call below authenticates as them.
create_user "$ADMIN_USER" "$ADMIN_PASSWORD" "gitadmin@example.com" --admin
create_user "$TEST_USER" "$TEST_PASSWORD" "testuser@example.com"

# The repositories proxy.config.json registers. auto_init gives each an initial commit on main so a
# clone has something to branch from.
for org in test-owner e2e-org; do
  api POST "orgs" "{\"username\":\"${org}\",\"visibility\":\"public\"}"
done
api POST "orgs/test-owner/repos" '{"name":"test-repo","auto_init":true,"default_branch":"main"}'
api POST "orgs/e2e-org/repos" '{"name":"sample-repo","auto_init":true,"default_branch":"main"}'

# testuser pushes to test-owner/test-repo through the proxy, so it needs write access upstream too.
api PUT "repos/test-owner/test-repo/collaborators/${TEST_USER}" '{"permission":"write"}'

log "done"
