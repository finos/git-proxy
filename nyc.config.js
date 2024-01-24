/* eslint-disable max-len */
'use strict';

const { execFileSync } = require('child_process');

let opts = {
  branches: 80,
  lines: 80,
  functions: 80,
  statements: 80,
};

// Only generate coverage report for changed files in PR
// see: https://github.com/actions/checkout/issues/438#issuecomment-1446882066
//      https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
if (process.env.GITHUB_BASE_REF !== undefined) {
  console.log('Generating coverage report for changed files...');
  try {
    const baseRef = execFileSync('git', [
      'rev-parse',
      `origin/${process.env.GITHUB_BASE_REF}`,
    ])
      .toString()
      .replace('\n', '');
    const headRef = process.env.GITHUB_SHA;
    const stdout = execFileSync('git', [
      'diff',
      '--name-only',
      `${baseRef}..${headRef}`,
    ]).toString();
    opts = {
      ...opts,
      include: stdout.split('\n'),
    };
  } catch (error) {
    console.log('Error: ', error);
  }
}

console.log('nyc config: ', opts);
module.exports = opts;
