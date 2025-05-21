/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
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

/* eslint-disable max-len */
const { execFileSync } = require('child_process');
const { writeFileSync, readFileSync, mkdtempSync } = require('fs');
const { tmpdir } = require('os');
const { sep } = require('path');
const JSFH_CONFIG = './jsfh.config.json';
const SCHEMA_FILE = './config.schema.json';
const OUTPUT_PATH = './website/docs/configuration/reference.mdx';

try {
  const osTempdir = tmpdir();
  const tempdir = mkdtempSync(`${osTempdir}${sep}`);

  const genDocOutput = execFileSync('generate-schema-doc', [
    '--config-file',
    JSFH_CONFIG,
    SCHEMA_FILE,
    `${tempdir}${sep}schema.md`,
  ]).toString('utf-8');
  console.log(genDocOutput);

  const schemaDoc = readFileSync(`${tempdir}${sep}schema.md`, 'utf-8')
    .replace(/\s\s\n\n<\/summary>/g, '\n</summary>')
    .replace(/# GitProxy configuration file/g, '# Schema Reference'); // https://github.com/finos/git-proxy/pull/327#discussion_r1377343213
  const docString = `---
title: Schema Reference
description: JSON schema reference documentation for GitProxy
---

${schemaDoc}
`;
  writeFileSync(OUTPUT_PATH, docString);
  console.log(`Wrote schema reference to ${OUTPUT_PATH}`);
} catch (err) {
  console.error(err);
}
