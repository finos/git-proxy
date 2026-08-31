#!/usr/bin/env bash
set -euo pipefail

CLEAN_BUILD=true
if [[ "${1:-}" == "--no-clean-build" ]]; then
  CLEAN_BUILD=false
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
SERVER_PID=""
cleanup() {
  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

cd "$ROOT"

if [[ "$CLEAN_BUILD" == true ]]; then
  echo "Building from a clean slate..."
  rm -rf dist build
  npm run build
fi

TARBALL="$WORK/$(npm pack --silent --pack-destination "$WORK")"
echo "Packed: $TARBALL"
FILES="$(tar tzf "$TARBALL")"

# UI must be inside the tarball
if ! grep -qx 'package/dist/build/index.html' <<<"$FILES"; then
  echo "FAIL: dist/build/index.html is missing from the tarball."
  echo "--- everything under dist/build ---"
  grep '^package/dist/build' <<<"$FILES" || echo "(dist/build is entirely absent)"
  echo "--- top level ---"
  sed 's|^package/||' <<<"$FILES" | cut -d/ -f1 | sort -u
  exit 1
fi

grep -qE '^package/dist/build/assets/.+\.js$' <<<"$FILES" \
  || { echo "FAIL: no JS bundle under dist/build/assets."; exit 1; }

# Install like a normal user
cd "$WORK"
npm init -y >/dev/null
npm install --no-audit --no-fund --loglevel=error "$TARBALL"

if (exec 3<>/dev/tcp/127.0.0.1/8080) 2>/dev/null; then
  echo "FAIL: port 8080 is already in use, refusing to test against a foreign server."
  exit 1
fi

# Boot from a scratch cwd so it writes its .data/.tmp
mkdir -p "$WORK/run" && cd "$WORK/run"
"$WORK/node_modules/.bin/git-proxy" > "$WORK/server.log" 2>&1 &
SERVER_PID=$!

for i in $(seq 1 60); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "FAIL: server exited before answering (see log below)"
    cat "$WORK/server.log"
    exit 1
  fi
  curl -fsS http://localhost:8080/api/v1/healthcheck >/dev/null 2>&1 && break
  if [[ $i -eq 60 ]]; then
    echo "FAIL: server did not come up within 60s"
    cat "$WORK/server.log"
    exit 1
  fi
  sleep 1
done

# Check UI wrapper is served 
HTML="$(curl -fsS http://localhost:8080/)"
if ! grep -q '<div id="root">' <<<"$HTML"; then
  echo "FAIL: / did not return the GitProxy UI wrapper."
  head -30 <<<"$HTML"
  exit 1
fi

# The bundled reference must resolve, not just exist as a string
ASSET="$(grep -oE '/assets/[A-Za-z0-9._-]+\.js' <<<"$HTML" | head -1)"
[[ -n "$ASSET" ]] || { echo "FAIL: index.html references no JS bundle."; exit 1; }
curl -fsS -o /dev/null "http://localhost:8080$ASSET" \
  || { echo "FAIL: $ASSET 404s."; exit 1; }

echo "PASS: packaged UI installs and serves correctly ($ASSET)"
