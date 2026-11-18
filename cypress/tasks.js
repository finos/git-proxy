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

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

/**
 * Run a command without a shell and return combined stdout/stderr.
 * @param {string} file
 * @param {string[]} args
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv, timeout?: number, failOnNonZeroExit?: boolean }} [options]
 */
function run(file, args, options = {}) {
  const { cwd, env, timeout = 30000, failOnNonZeroExit = true } = options;
  try {
    const stdout = execFileSync(file, args, {
      cwd,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { code: 0, stdout: stdout ?? '', stderr: '' };
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? '';
    const stderr = error.stderr?.toString?.() ?? '';
    if (!failOnNonZeroExit) {
      return { code: error.status ?? 1, stdout, stderr };
    }
    throw new Error(
      `${file} ${args.join(' ')} failed` +
        (stdout || stderr ? `:\n${stdout}${stderr}` : `: ${error.message}`),
      { cause: error },
    );
  }
}

/**
 * Mint a Forgejo access token with basic auth against a self-signed server.
 * @param {{ username: string, password: string, gitServerUrl: string }} params
 */
async function mintUpstreamToken({ username, password, gitServerUrl }) {
  const name = `cypress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const url = new URL(`/api/v1/users/${username}/tokens`, gitServerUrl);
  const body = JSON.stringify({ name, scopes: ['write:repository', 'read:user'] });
  const auth = Buffer.from(`${username}:${password}`).toString('base64');

  const responseBody = await new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        // The Forgejo test server uses a self-signed certificate.
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`Token mint failed (${res.statusCode}): ${data}`));
            return;
          }
          resolve(data);
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });

  let parsed;
  try {
    parsed = JSON.parse(responseBody);
  } catch (error) {
    throw new Error(`Could not parse token response for ${username}: ${responseBody}`, {
      cause: error,
    });
  }

  if (!parsed?.sha1) {
    throw new Error(`Could not mint a token for ${username}: ${responseBody}`);
  }

  return parsed.sha1;
}

/**
 * Clone through the proxy, create a commit, push it, and return the push ID from the proxy output.
 * @param {{
 *   gitUser: string,
 *   gitPassword: string,
 *   gitEmail: string,
 *   uniqueSuffix: string,
 *   proxyUrl: string,
 *   gitServerTarget: string,
 * }} params
 */
function createPush({ gitUser, gitPassword, gitEmail, uniqueSuffix, proxyUrl, gitServerTarget }) {
  const repoUrl = `${proxyUrl}/${gitServerTarget}/test-owner/test-repo.git`;
  const cloneDir = path.join('/tmp', `cypress-push-${uniqueSuffix}`);

  const gitCredentialEnv = {
    GIT_TERMINAL_PROMPT: '0',
    NODE_TLS_REJECT_UNAUTHORIZED: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `url.${proxyUrl.replace('://', `://${gitUser}:${gitPassword}@`)}.insteadOf`,
    GIT_CONFIG_VALUE_0: proxyUrl,
  };

  fs.rmSync(cloneDir, { recursive: true, force: true });
  run('git', ['clone', repoUrl, cloneDir], {
    timeout: 30000,
    env: gitCredentialEnv,
  });
  run('git', ['-C', cloneDir, 'config', 'user.name', gitUser]);
  run('git', ['-C', cloneDir, 'config', 'user.email', gitEmail]);

  // Pull any upstream changes to avoid conflicts from previous test runs
  run('git', ['-C', cloneDir, 'pull', '--rebase', 'origin', 'main'], {
    failOnNonZeroExit: false,
    timeout: 30000,
    env: gitCredentialEnv,
  });

  const timestamp = Date.now();
  fs.writeFileSync(
    path.join(cloneDir, `cypress-test-${uniqueSuffix}.txt`),
    `test-${uniqueSuffix}-${timestamp}\n`,
  );
  run('git', ['-C', cloneDir, 'add', '.']);
  run('git', ['-C', cloneDir, 'commit', '-m', `cypress e2e test: ${uniqueSuffix}`]);

  const pushResult = run('git', ['-C', cloneDir, 'push', 'origin', 'main'], {
    failOnNonZeroExit: false,
    timeout: 30000,
    env: gitCredentialEnv,
  });
  const output = `${pushResult.stdout}${pushResult.stderr}`;
  const match = output.match(/dashboard\/push\/([a-f0-9_]+)/);
  fs.rmSync(cloneDir, { recursive: true, force: true });

  if (!match) {
    throw new Error(`Could not extract push ID from git output:\n${output}`);
  }

  return match[1];
}

module.exports = {
  mintUpstreamToken,
  createPush,
};
