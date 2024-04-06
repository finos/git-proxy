/* eslint-disable max-len */

const chai = require('chai');
const fs = require('fs');
const crypto = require('crypto');
const readline = require('node:readline/promises');
const { logger } = require('../src/logging/index');

const expect = chai.expect;
const assert = chai.assert;

const gitProxyLogFilePath = './src/logging/git-proxy.log';

const findLogLineInFile = async (filePath, loggerTestLine) => {
  return new Promise((resolve) => {

    const stream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    rl.on('line', line => {
      if (line.includes(loggerTestLine)) {
        console.log(`Found the log line: ${line}`);
        console.log(`Expected line is: ${loggerTestLine}`);

        rl.pause();
        resolve(true);
      }
    });

    rl.on('close', () => {
      resolve(false);
    });

    rl.on('error', error => {
      console.log(`Error attempting to read file: ${error}`)
      resolve(false);
    });
  });
};

describe('logger file functionality', () => {

  it ('startup creates a generic git-proxy.log file', async () => {
    // Assert file exists
    const fileExists = fs.existsSync(gitProxyLogFilePath);
    assert.isTrue(fileExists);
  });

  it ('logger functions correctly', async () => {
    // create test log line and ensure it is the last line logged
    const loggerTestLine = `**logging functionality test: ${crypto.randomBytes(20).toString('hex')}**`;

    logger.info(loggerTestLine);
    const isLogLineInFile = await findLogLineInFile(gitProxyLogFilePath, loggerTestLine);
    assert.isTrue(isLogLineInFile);
  });

  it ('creates an error specific error.log file', async () => {
    // does error.log exist && only error logs
    // trigger some error and check error is in log e.g. `error: Rejecting repo thisproject/repo-is-not-ok not in the authorisedList`
    // fs.readFile('./src/logging/git-proxy.log', 'utf8', (err, data) => {
    //   console.log(data);
    // });
  })
  
});