/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 ** Plugin that checks if any vulnerable dependency is used in a git repo
 ** Uses OWASP's dependency-check to achieve this
 ** The filtering strictness of the plugin can be decided by the user
 ** by using the "dependencyVulnThreshold" key in config JSON.
 ** "dependencyVulnThreshold" decides the lower bound to the filtering.
 ** So, if "dependencyVulnThreshold" is "LOW", any vulnerabilities of level LOW or higher
 ** would block the push
 ** Allowed values for dependencyVulnThreshold are info, low, medium, high, critical
 ** NOTE: This plugin expects dependency-check to be installed and in the
 **       path environment variable
 */

import { PushActionPlugin } from '@finos/git-proxy/plugin';
import { Step } from '@finos/git-proxy/proxy/actions';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SEVERITY_LEVELS = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

const EMPTY_COMMIT_HASH = '0000000000000000000000000000000000000000';
const EMPTY_TREE_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

/**
 * Run a command asynchronously, collecting stdout/stderr.
 * @param {string} cwd Working directory
 * @param {string} command Executable to run
 * @param {string[]} args Arguments
 * @param {object} options Additional spawn options
 * @return {Promise<{exitCode: number|null, stdout: string, stderr: string}>}
 */
function runCommand(cwd, command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('close', (exitCode) => resolve({ exitCode, stdout, stderr }));
    child.on('error', reject);
  });
}

class CheckDependencyVulnPlugin extends PushActionPlugin {
  constructor() {
    super(async function exec(req, action) {
      const step = new Step('checkDependencyVulnPlugin');

      const thresholdKey = (process.env.DEPENDENCY_VULN_THRESHOLD || 'HIGH').toLowerCase();
      const minLevel = SEVERITY_LEVELS[thresholdKey] ?? SEVERITY_LEVELS.high;

      // Unique temp directory per push to avoid collisions under concurrent requests
      const tempDir = path.join('.tempRepo', String(action.timestamp));

      try {
        // Build clone URL with credentials from the Authorization header,
        // mirroring the approach used by the pullRemote processor
        let cloneUrl = action.url;
        const authHeader = req.headers?.authorization;
        if (authHeader?.startsWith('Basic ')) {
          const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
          const colonIdx = credentials.indexOf(':');
          if (colonIdx !== -1) {
            const username = encodeURIComponent(credentials.slice(0, colonIdx));
            const password = encodeURIComponent(credentials.slice(colonIdx + 1));
            const urlObj = new URL(action.url);
            urlObj.username = username;
            urlObj.password = password;
            cloneUrl = urlObj.toString();
          }
        }

        fs.mkdirSync(tempDir, { recursive: true });

        // Clone the remote repository as a bare clone
        step.log(`Cloning ${action.url} for dependency scan`);
        const cloneResult = await runCommand(tempDir, 'git', [
          'clone',
          cloneUrl,
          action.repoName,
          '--bare',
        ]);

        if (cloneResult.exitCode !== 0) {
          step.setError(`Failed to clone repository for dependency scan: ${cloneResult.stderr}`);
          action.addStep(step);
          return action;
        }

        // Apply the pushed pack data to the local bare clone.
        // req.body is the raw pack buffer, set by proxyFilter before the chain runs.
        spawnSync('git', ['receive-pack', action.repoName], {
          cwd: tempDir,
          input: req.body,
          maxBuffer: 50 * 1024 * 1024,
        });

        const repoDir = path.join(tempDir, action.repoName);

        // Resolve the base commit for the diff, matching the logic in getDiff.ts
        let commitFrom = EMPTY_TREE_HASH;
        if (action.commitFrom === EMPTY_COMMIT_HASH) {
          const lastParent = action.commitData?.[action.commitData.length - 1]?.parent;
          if (lastParent && lastParent !== EMPTY_COMMIT_HASH) {
            commitFrom = lastParent;
          }
        } else {
          commitFrom = action.commitFrom;
        }

        // Get files added or modified by this push
        const diffResult = spawnSync('git', ['diff', '--name-only', commitFrom, action.commitTo], {
          cwd: repoDir,
          encoding: 'utf-8',
          maxBuffer: 50 * 1024 * 1024,
        });

        const changedFiles = diffResult.stdout.split('\n').filter((f) => f.trim() !== '');
        step.log(`Changed files: ${changedFiles.join(', ')}`);

        if (changedFiles.length === 0) {
          step.log('No changed files to scan for dependency vulnerabilities.');
          action.addStep(step);
          return action;
        }

        // Extract the content of changed files from the pushed commit into a
        // staging directory for dependency-check to scan
        const scanInputDir = path.join(tempDir, 'scan-input');
        fs.mkdirSync(scanInputDir, { recursive: true });

        for (const filePath of changedFiles) {
          const showResult = spawnSync('git', ['show', `${action.commitTo}:${filePath}`], {
            cwd: repoDir,
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024,
          });

          if (showResult.status === 0) {
            const destPath = path.join(scanInputDir, filePath);
            // Create parent directories for nested paths (e.g. src/lib/foo.json)
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.writeFileSync(destPath, showResult.stdout);
          }
        }

        // Run OWASP dependency-check.
        // dependency-check may be a shell wrapper script, so shell: true is required.
        // Exit code 0 = no findings, 1 = findings present, other values = tool error.
        step.log('Running OWASP dependency-check...');
        const scanResult = await runCommand(
          tempDir,
          'dependency-check',
          [
            '--noupdate',
            '--project',
            'git-proxy-dependency-check',
            '--scan',
            scanInputDir,
            '--format',
            'JSON',
            '--out',
            tempDir,
          ],
          { shell: true },
        );

        if (scanResult.exitCode !== 0 && scanResult.exitCode !== 1) {
          step.setError(
            'dependency-check failed to run. Ensure it is installed and in PATH, and that ' +
              '`dependency-check --updateonly` has been run at least once.',
          );
          action.addStep(step);
          return action;
        }

        const reportPath = path.join(tempDir, 'dependency-check-report.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

        const findings = report.dependencies.flatMap((dep) =>
          (dep.vulnerabilities ?? [])
            .filter((vuln) => {
              const level = SEVERITY_LEVELS[vuln.severity?.toLowerCase()] ?? 0;
              return level >= minLevel;
            })
            .map((vuln) => ({
              file: dep.fileName,
              cve: vuln.name,
              severity: vuln.severity?.toUpperCase() ?? 'UNKNOWN',
              description: (vuln.description ?? '').substring(0, 150),
            })),
        );

        if (findings.length > 0) {
          const details = findings
            .map((f) => `  [${f.severity}] ${f.cve} in ${f.file}: ${f.description}`)
            .join('\n');
          step.setAsyncBlock(
            `Dependency vulnerabilities found at or above ${thresholdKey.toUpperCase()} severity:\n${details}`,
          );
        } else {
          step.log(
            `No dependency vulnerabilities at or above ${thresholdKey.toUpperCase()} severity found.`,
          );
        }
      } catch (error) {
        step.setError(`Dependency check encountered an unexpected error: ${error.message}`);
      } finally {
        // Clean up the temp directory regardless of outcome
        fs.rm(tempDir, { recursive: true, force: true }, () => {});
        action.addStep(step);
      }

      return action;
    });
  }
}

export default new CheckDependencyVulnPlugin();
