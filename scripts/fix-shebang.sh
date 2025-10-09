#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Replace tsx with node in the shebang
sed -ie '1s/tsx/node/' dist/index.js
