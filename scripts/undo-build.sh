#!/usr/bin/env bash
set -euxo pipefail

# Undo what was done by build-for-publish.sh in the event this was ran locally

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

rm -rf dist index.js index.d.ts || true
git checkout src index.ts
git clean -f src
