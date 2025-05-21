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
import { describe, it, expect } from '@jest/globals';
import { execFile } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const cliPath = path.resolve(__dirname, '../dist/cli.js');

const doIntegration = process.env['TEST_INTEGRATION']?.toLowerCase() === 'true';
const doRemote = process.env['TEST_REMOTE']?.toLowerCase() === 'true';

const url = process.env['TEST_LI_URL'] || 'http://localhost:3000';

const describeIntegration = doIntegration ? describe : describe.skip;
// const describeRemote = doRemote ? describe : describe.skip;
const itRemote = doRemote ? it : it.skip;

describeIntegration('CLI Integration Tests', () => {
  it('should show help with no arguments', (done) => {
    execFile('node', [cliPath], (error, stdout, stderr) => {
      expect(stderr).toContain(' <command>');
      expect(stderr).toContain('Not enough non-option arguments');
      expect(stderr).toContain(' add-license ');
      done();
    });
  });

  describeIntegration('add-license', () => {
    it('--help', (done) => {
      execFile('node', [cliPath, 'add-license', '--help'], (error, stdout) => {
        expect(stdout).toContain(' add-license ');
        expect(stdout).toContain('--require-cal');
        done();
      });
    });

    it('should require --li-url', (done) => {
      execFile('node', [cliPath, 'add-license'], (error, stdout, stderr) => {
        expect(stderr).toContain('Missing required argument: li-url');
        expect(stderr).toContain('--require-cal');
        done();
      });
    });

    itRemote('should apply a license', (done) => {
      execFile(
        'node',
        [cliPath, 'add-license', '--li-url', url, 'apache-2.0'],
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
