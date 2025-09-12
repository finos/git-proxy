const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const originalConfigPath = path.join(__dirname, '../../../proxy.config.json');
const testConfigPath = path.join(__dirname, './test-config.json');

// Backup original config
if (fs.existsSync(originalConfigPath)) {
  fs.copyFileSync(originalConfigPath, originalConfigPath + '.backup');
}

// Copy test config
fs.copyFileSync(testConfigPath, originalConfigPath);

console.log('Starting MongoDB integration tests...');
console.log('MongoDB Connection String:', process.env.GIT_PROXY_MONGO_CONNECTION_STRING);

// Run the MongoDB integration tests and database comparison tests
const testProcess = spawn(
  'npx',
  [
    'ts-mocha',
    'test/db/mongo/integration.test.js',
    'test/db/database-comparison.test.js',
    '--timeout',
    '15000',
    '--exit',
    '--project',
    '../../tsconfig.json',
  ],
  {
    cwd: path.join(__dirname, '../../..'),
    stdio: 'inherit',
    env: process.env,
  },
);

testProcess.on('close', (code) => {
  // Restore original config
  if (fs.existsSync(originalConfigPath + '.backup')) {
    fs.copyFileSync(originalConfigPath + '.backup', originalConfigPath);
    fs.unlinkSync(originalConfigPath + '.backup');
  }

  process.exit(code);
});
