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

console.log('Starting MongoDB with Docker...');

// Start MongoDB container
const dockerComposeProcess = spawn(
  'docker',
  ['compose', '-f', 'docker-compose.mongo-test.yml', 'up', '-d'],
  {
    cwd: path.join(__dirname, '../../..'),
    stdio: 'inherit',
  },
);

dockerComposeProcess.on('close', (code) => {
  if (code !== 0) {
    console.error('Failed to start MongoDB container.');
    process.exit(1);
  }

  console.log('MongoDB container started, waiting for it to be ready...');

  // Wait for MongoDB to be ready
  setTimeout(() => {
    process.env.GIT_PROXY_MONGO_CONNECTION_STRING = 'mongodb://localhost:27017/git-proxy-test';
    console.log('Running MongoDB integration tests...');
    console.log('MongoDB Connection String:', process.env.GIT_PROXY_MONGO_CONNECTION_STRING);

    // Run the MongoDB integration tests and database comparison tests
    const testProcess = spawn(
      'npx',
      [
        'ts-mocha',
        'test/db/mongo/integration.test.js',
        'test/db/database-comparison.test.js',
        '--timeout',
        '30000',
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

      // Stop MongoDB container
      console.log('Stopping MongoDB container...');
      const stopProcess = spawn(
        'docker',
        ['compose', '-f', 'docker-compose.mongo-test.yml', 'down'],
        {
          cwd: path.join(__dirname, '../../..'),
          stdio: 'inherit',
        },
      );

      stopProcess.on('close', () => {
        process.exit(code);
      });
    });
  }, 10000); // Wait 10 seconds for MongoDB to fully start
});
