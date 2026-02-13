#!/usr/bin/env node

/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

const fs = require('fs');
const path = require('path');

const distIndexPath = path.join(__dirname, '..', 'dist', 'index.js');

if (fs.existsSync(distIndexPath)) {
  let content = fs.readFileSync(distIndexPath, 'utf-8');
  // Replace tsx with node in the shebang (first line)
  content = content.replace(/^#!.*tsx/, '#!/usr/bin/env node');
  fs.writeFileSync(distIndexPath, content);
  console.log('Fixed shebang in dist/index.js');
} else {
  console.log('dist/index.js not found, skipping shebang fix');
}
