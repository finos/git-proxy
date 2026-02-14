import * as fs from 'fs';
import * as path from 'path';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git', 'generated'];

function hasLicenseHeader(fileContent: string): boolean {
  const normalizedContent = fileContent.trim().substring(0, 500);

  return (
    normalizedContent.includes('@license') ||
    normalizedContent.includes('Licensed to the Apache Software Foundation')
  );
}

function checkFile(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');

  if (!hasLicenseHeader(content)) {
    console.error(`Missing license header: ${filePath}`);
    return false;
  }

  return true;
}

function processDirectory(dirPath: string): boolean {
  let allValid = true;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.includes(entry.name)) {
        if (!processDirectory(fullPath)) {
          allValid = false;
        }
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SOURCE_EXTENSIONS.includes(ext)) {
        if (!checkFile(fullPath)) {
          allValid = false;
        }
      }
    }
  }

  return allValid;
}

function main(): void {
  try {
    console.log('Checking license headers...\n');

    const isValid = processDirectory('.');

    if (!isValid) {
      console.error(
        '\nSome files are missing license headers.\n' + 'Run: npm run add-license-headers',
      );
      process.exit(1);
    }

    console.log('All files contain license headers.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
