#!/usr/bin/env bash
set -euxo pipefail

# Clean build artifacts

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

rm -rf dist
