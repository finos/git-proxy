#!/usr/bin/env bash
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
# 
#    http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.    
# /
set -euo pipefail

# This script allows for emitting js and definitions from the typescript into
# the same import locations as the original files.
# When we adjust how we import the library we can move to a "dist" folder and
# explicit "exports".

if [ "${IS_PUBLISHING:-}" != "YES" ]; then
  echo "This script is intended to prepare the directory for publishing"
  echo "and replaces files. If you only want to build the UI run \`npm run build-ui\`."
  echo "Otherwise set IS_PUBLISHING to \"YES\""
  exit 1
fi

set -x

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

rm -rf dist || true
tsc --project tsconfig.publish.json
# replace tsx with node for the new index.js
sed -ie '1s/tsx/node/' dist/index.js
# ensure it's executable
chmod +x dist/index.js
# move the ts source
mv src src-old
# move the built source
mv dist/src dist/index.js dist/index.d.ts .
# copy back unchanged ui code
# could probably drop this as the ui code shouldn't really be imported from
# the main package but keep for compat until split out.
mv src-old/ui src/ui
rm -rf src-old index.ts dist
