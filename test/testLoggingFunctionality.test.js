/* eslint-disable max-len */

const chai = require('chai');
const fs = require('fs');
const crypto = require('crypto');
const readline = require('node:readline/promises');
const { logger } = require('../src/logging/index');

const assert = chai.assert;

const gitProxyLogFilePath = './src/logging/git-proxy.log';
const errorLogFilePath = './src/logging/error.log';

const isLogLineInFile = async (filePath, loggerTestLine) => {
  return new Promise((resolve) => {
    const stream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
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

    rl.on('error', (error) => {
      console.log(`Error attempting to read file: ${error}`);
      resolve(false);
    });
  });
};

describe('logger file functionality', () => {
  it('logging info hits git-proxy.log file & not error.log file', async () => {
    const loggerTestLine = `**logging functionality info test: ${crypto.randomBytes(20).toString('hex')}**`;

    logger.info(loggerTestLine);
    const isLogLineInGitProxyLog = await isLogLineInFile(
      gitProxyLogFilePath,
      loggerTestLine,
    );

    const isLogLineInErrorLog = await isLogLineInFile(
      errorLogFilePath,
      loggerTestLine,
    );

    assert.isTrue(isLogLineInGitProxyLog);
    assert.isFalse(isLogLineInErrorLog);
  });

  it('logging error hits error.log & git-proxy.log file', async () => {
    const loggerTestLine = `**logging functionality error test: ${crypto.randomBytes(20).toString('hex')}**`;

    logger.error(loggerTestLine);
    const isLogLineInErrorLog = await isLogLineInFile(
      errorLogFilePath,
      loggerTestLine,
    );

    const isLogLineInGitProxyLog = await isLogLineInFile(
      gitProxyLogFilePath,
      loggerTestLine,
    );

    assert.isTrue(isLogLineInErrorLog);
    assert.isTrue(isLogLineInGitProxyLog);
  });
});
