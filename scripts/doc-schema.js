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

  const schemaDoc = readFileSync(`${tempdir}${sep}schema.md`, 'utf-8');

  writeFileSync(
    OUTPUT_PATH,
    `---
title: Schema Reference
description: JSON schema reference documentation for Git Proxy
---

${schemaDoc}
`,
  );
  console.log(`Wrote schema reference to ${OUTPUT_PATH}`);
} catch (err) {
  console.error(err);
}
