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

import * as fs from 'fs';
import * as path from 'path';

const LICENSE_HEADER_FILE = './scripts/license-header.txt';
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git'];

function readLicenseHeader(): string {
  return fs.readFileSync(LICENSE_HEADER_FILE, 'utf-8');
}

function hasShebang(fileContent: string): boolean {
  return fileContent.startsWith('#!');
}

function extractShebang(fileContent: string): string {
  return fileContent.split('\n')[0];
}

function hasLicenseHeader(fileContent: string, licenseHeader: string): boolean {
  const normalizedContent = fileContent.trim().substring(0, 500);

  return (
    normalizedContent.includes('@license') ||
    normalizedContent.includes('Licensed to the Apache Software Foundation')
  );
}

function addLicenseHeader(filePath: string, licenseHeader: string): void {
  let content = fs.readFileSync(filePath, 'utf-8');
  let shebang = '';

  if (hasLicenseHeader(content, licenseHeader)) {
    console.log(`Skipping ${filePath} (already has header)`);
    return;
  }

  if (hasShebang(content)) {
    shebang = extractShebang(content);
    content = content.replace(shebang, '');
  }

  const newContent = shebang
    ? shebang + '\n\n' + licenseHeader + content
    : licenseHeader + '\n\n' + content;
  fs.writeFileSync(filePath, newContent, 'utf-8');
  console.log(`Added header to ${filePath}`);
}

function processDirectory(dirPath: string, licenseHeader: string): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name)) {
        processDirectory(fullPath, licenseHeader);
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SOURCE_EXTENSIONS.includes(ext)) {
        addLicenseHeader(fullPath, licenseHeader);
      }
    }
  }
}

function main(): void {
  try {
    console.log('Reading license header...');
    const licenseHeader = readLicenseHeader();

    console.log('Processing files...\n');
    processDirectory('.', licenseHeader);

    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
