import { describe, it, expect } from '@jest/globals';
import { exec } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const cliPath = path.resolve(__dirname, '../dist/cli.js');

const doIntegration = process.env['TEST_INTEGRATION']?.toLowerCase() === 'true';
const doRemote = process.env['TEST_REMOTE']?.toLowerCase() === 'true';

const describeIntegration = doIntegration ? describe : describe.skip;
// const describeRemote = doRemote ? describe : describe.skip;
const itRemote = doRemote ? it : it.skip;

describeIntegration('CLI Integration Tests', () => {
  it('should show help with no arguments', (done) => {
    exec(`node ${cliPath}`, (error, stdout, stderr) => {
      expect(stderr).toContain(' <command>');
      expect(stderr).toContain('Not enough non-option arguments');
      expect(stderr).toContain(' add-license ');
      done();
    });
  });

  describeIntegration('add-license', () => {
    it('--help', (done) => {
      exec(`node ${cliPath} add-license --help`, (error, stdout) => {
        expect(stdout).toContain(' add-license ');
        expect(stdout).toContain('--require-cal');
        done();
      });
    });

    it('should require --li-url', (done) => {
      exec(`node ${cliPath} add-license`, (error, stdout, stderr) => {
        expect(stderr).toContain('Missing required argument: li-url');
        expect(stderr).toContain('--require-cal');
        done();
      });
    });

    itRemote('should apply a license', (done) => {
      exec(
        `node ${cliPath} add-license --li-url http://localhost:3000 apache-2.0`,
        (error, stdout, stderr) => {
          expect(stdout).toContain('fetching license list');
          expect(stdout).toContain('Choose A License info');
          expect(stdout).toContain('added to inventory');
          done();
        },
      );
    });
  });
});
