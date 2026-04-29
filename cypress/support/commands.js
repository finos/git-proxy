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

// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

/**
 * Helper to get the API base URL for cy.request calls.
 * cy.request with relative URLs may not resolve correctly in all environments,
 * so we use absolute URLs constructed from Cypress.config('baseUrl').
 */
function getApiBaseUrl() {
  return Cypress.env('API_BASE_URL') || Cypress.config('baseUrl');
}

// start of a login command with sessions
// TODO: resolve issues with the CSRF token
Cypress.Commands.add('login', (username, password) => {
  cy.session([username, password], () => {
    cy.visit('/login');
    cy.intercept('GET', '**/api/auth/profile').as('getUser');

    cy.get('[data-test=username]').type(username);
    cy.get('[data-test=password]').type(password);
    cy.get('[data-test=login]').click();

    cy.wait('@getUser');
    cy.url().should('include', '/dashboard/repo');
  });
});

Cypress.Commands.add('logout', () => {
  cy.clearCookies();
});

Cypress.Commands.add('getCSRFToken', () => {
  return cy.request('GET', `${getApiBaseUrl()}/api/v1/repo`).then((res) => {
    let cookies = res.headers['set-cookie'];

    if (typeof cookies === 'string') {
      cookies = [cookies];
    }

    if (!cookies) {
      // No Set-Cookie header: CSRF protection is disabled (expected in NODE_ENV=test).
      cy.log('getCSRFToken: no cookies in response, assuming CSRF is disabled');
      return cy.wrap('');
    }

    const csrfCookie = cookies.find((c) => c.startsWith('csrf='));
    if (!csrfCookie) {
      cy.log('getCSRFToken: no csrf cookie found, assuming CSRF is disabled');
      return cy.wrap('');
    }

    const token = csrfCookie.split('=')[1].split(';')[0];
    return cy.wrap(decodeURIComponent(token));
  });
});

Cypress.Commands.add('createTestTagPush', (pushData = {}) => {
  const defaultTagPush = {
    id: `test-tag-push-${Date.now()}`,
    steps: [],
    error: false,
    blocked: true,
    allowPush: false,
    authorised: false,
    canceled: false,
    rejected: false,
    autoApproved: false,
    autoRejected: false,
    type: 'push',
    method: 'get',
    timestamp: Date.now(),
    project: 'cypress-test',
    repoName: 'test-repo.git',
    url: 'https://github.com/cypress-test/test-repo.git',
    repo: 'cypress-test/test-repo.git',
    user: 'test-tagger',
    userEmail: 'test-tagger@test.com',
    branch: 'refs/heads/main',
    tag: 'refs/tags/v1.0.0',
    commitFrom: '0000000000000000000000000000000000000000',
    commitTo: 'abcdef1234567890abcdef1234567890abcdef12',
    lastStep: null,
    blockedMessage: '\n\n\nGitProxy has received your tag push\n\n\n',
    _id: null,
    attestation: null,
    tagData: [
      {
        tagName: 'v1.0.0',
        type: 'annotated',
        tagger: 'test-tagger',
        message: 'Release version 1.0.0\n\nThis is a test tag release for Cypress testing.',
        timestamp: Math.floor(Date.now() / 1000),
      },
    ],
    commitData: [
      {
        commitTs: Math.floor(Date.now() / 1000) - 300,
        commitTimestamp: Math.floor(Date.now() / 1000) - 300,
        message: 'feat: add new tag push feature',
        committer: 'test-committer',
        author: 'test-author',
        authorEmail: 'test-author@test.com',
      },
    ],
    diff: {
      content: '+++ test tag push implementation',
    },
    ...pushData,
  };

  // For now, intercept the push API calls and return our test data
  cy.intercept('GET', '**/api/v1/push*', {
    statusCode: 200,
    body: [defaultTagPush],
  }).as('getPushes');

  return cy.wrap(defaultTagPush);
});

Cypress.Commands.add('createUser', (username, password, email, gitAccount) => {
  cy.request({
    method: 'POST',
    url: `${getApiBaseUrl()}/api/auth/create-user`,
    body: { username, password, email, gitAccount, admin: false },
    failOnStatusCode: false,
  });
});

Cypress.Commands.add('addUserPushPermission', (repoId, username) => {
  cy.request({
    method: 'PATCH',
    url: `${getApiBaseUrl()}/api/v1/repo/${repoId}/user/push`,
    body: { username },
    failOnStatusCode: false,
  });
});

Cypress.Commands.add('addUserAuthorisePermission', (repoId, username) => {
  cy.request({
    method: 'PATCH',
    url: `${getApiBaseUrl()}/api/v1/repo/${repoId}/user/authorise`,
    body: { username },
    failOnStatusCode: false,
  });
});

Cypress.Commands.add('getTestRepoId', () => {
  const url = `${getApiBaseUrl()}/api/v1/repo`;
  cy.request({
    method: 'GET',
    url,
    headers: { Accept: 'application/json' },
    failOnStatusCode: false,
  }).then((res) => {
    if (res.status !== 200) {
      throw new Error(
        `GET ${url} returned status ${res.status}: ${JSON.stringify(res.body).slice(0, 500)}`,
      );
    }
    if (!Array.isArray(res.body)) {
      throw new Error(
        `GET ${url} returned non-array (${typeof res.body}): ${JSON.stringify(res.body).slice(0, 500)}`,
      );
    }
    const gitServerTarget = Cypress.env('GIT_SERVER_TARGET') || 'git-server:8443';
    const repo = res.body.find(
      (r) => r.url === `https://${gitServerTarget}/test-owner/test-repo.git`,
    );
    if (!repo) {
      throw new Error(
        `test-owner/test-repo not found in database. Repos: ${res.body.map((r) => r.url).join(', ')}`,
      );
    }
    return cy.wrap(repo._id);
  });
});

Cypress.Commands.add('cleanupTestRepos', () => {
  cy.getCSRFToken().then((csrfToken) => {
    cy.request({
      method: 'GET',
      url: `${getApiBaseUrl()}/api/v1/repo`,
      failOnStatusCode: false,
    }).then((res) => {
      if (res.status !== 200 || !Array.isArray(res.body)) return;
      const testRepos = res.body.filter((r) => r.project === 'cypress-test');
      testRepos.forEach((repo) => {
        cy.request({
          method: 'DELETE',
          url: `${getApiBaseUrl()}/api/v1/repo/${repo._id}/delete`,
          headers: { 'X-CSRF-TOKEN': csrfToken },
          failOnStatusCode: false,
        });
      });
    });
  });
});

Cypress.Commands.add('deleteRepo', (repoId) => {
  cy.getCSRFToken().then((csrfToken) => {
    cy.request({
      method: 'DELETE',
      url: `${getApiBaseUrl()}/api/v1/repo/${repoId}/delete`,
      headers: {
        'X-CSRF-TOKEN': csrfToken,
      },
      failOnStatusCode: false,
    });
  });
});

Cypress.Commands.add('createPush', (gitUser, gitPassword, gitEmail, uniqueSuffix) => {
  const proxyUrl = Cypress.env('GIT_PROXY_URL') || 'http://localhost:8000';
  const gitServerTarget = Cypress.env('GIT_SERVER_TARGET') || 'git-server:8443';
  const repoUrl = `${proxyUrl}/${gitServerTarget}/test-owner/test-repo.git`;
  const cloneDir = `/tmp/cypress-push-${uniqueSuffix}`;

  // Pass credentials via GIT_CONFIG_* env vars to avoid exposing them in command output
  const gitCredentialEnv = {
    GIT_TERMINAL_PROMPT: '0',
    NODE_TLS_REJECT_UNAUTHORIZED: '0',
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `url.${proxyUrl.replace('://', `://${gitUser}:${gitPassword}@`)}.insteadOf`,
    GIT_CONFIG_VALUE_0: proxyUrl,
  };

  cy.exec(`rm -rf ${cloneDir}`, { failOnNonZeroExit: false });
  cy.exec(`git clone ${repoUrl} ${cloneDir}`, {
    timeout: 30000,
    env: gitCredentialEnv,
  });
  cy.exec(`git -C ${cloneDir} config user.name "${gitUser}"`);
  cy.exec(`git -C ${cloneDir} config user.email "${gitEmail}"`);

  // Pull any upstream changes to avoid conflicts from previous test runs
  cy.exec(`git -C ${cloneDir} pull --rebase origin main`, {
    failOnNonZeroExit: false,
    timeout: 30000,
    env: gitCredentialEnv,
  });

  const timestamp = Date.now();
  cy.exec(
    `echo "test-${uniqueSuffix}-${timestamp}" > ${cloneDir}/cypress-test-${uniqueSuffix}.txt`,
  );
  cy.exec(`git -C ${cloneDir} add .`);
  cy.exec(`git -C ${cloneDir} commit -m "cypress e2e test: ${uniqueSuffix}"`);
  cy.exec(`git -C ${cloneDir} push origin main 2>&1`, {
    failOnNonZeroExit: false,
    timeout: 30000,
    env: gitCredentialEnv,
  }).then((result) => {
    const output = result.stdout + result.stderr;
    const match = output.match(/dashboard\/push\/([a-f0-9_]+)/);
    if (!match) {
      throw new Error(`Could not extract push ID from git output:\n${output}`);
    }
    cy.exec(`rm -rf ${cloneDir}`, { failOnNonZeroExit: false });
    return cy.wrap(match[1]);
  });
});
