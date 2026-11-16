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
  return Cypress.expose('API_BASE_URL') || Cypress.config('baseUrl');
}

/**
 * Logs in through the API and caches the session. The login form itself is covered by
 * login.cy.js; going through the API here keeps every other spec independent of form timing.
 */
Cypress.Commands.add('login', (username, password) => {
  cy.session([username, password], () => {
    cy.getCSRFToken().then((csrfToken) => {
      cy.request({
        method: 'POST',
        url: `${getApiBaseUrl()}/api/auth/login`,
        body: { username, password },
        headers: { 'X-CSRF-TOKEN': csrfToken },
      })
        .its('status')
        .should('eq', 200);
    });
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
    tags: ['refs/tags/v1.0.0'],
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
    diff: '+++ test tag push implementation',
    ...pushData,
  };

  // For now, intercept the push API calls and return our test data
  cy.intercept('GET', '**/api/v1/push*', {
    statusCode: 200,
    body: [defaultTagPush],
  }).as('getPushes');

  return cy.wrap(defaultTagPush);
});

Cypress.Commands.add('registerTestRepo', (url) => {
  cy.intercept('GET', '**/api/v1/repo*', {
    statusCode: 200,
    body: [
      {
        _id: 'cypress-test-repo-id',
        project: 'cypress-test',
        name: 'test-repo',
        url,
        proxyURL: '',
        users: { canPush: [], canAuthorise: [] },
      },
    ],
  }).as('getRepos');
});

Cypress.Commands.add('createUser', (username, password, email, scmIdentities = {}) => {
  cy.getCSRFToken().then((csrfToken) => {
    cy.request({
      method: 'POST',
      url: `${getApiBaseUrl()}/api/auth/create-user`,
      body: { username, password, email, admin: false, scmIdentities },
      headers: { 'X-CSRF-TOKEN': csrfToken },
      failOnStatusCode: false,
    });
  });
});

Cypress.Commands.add('addUserPushPermission', (repoId, username) => {
  cy.getCSRFToken().then((csrfToken) => {
    cy.request({
      method: 'PATCH',
      url: `${getApiBaseUrl()}/api/v1/repo/${repoId}/user/push`,
      body: { username },
      headers: { 'X-CSRF-TOKEN': csrfToken },
      failOnStatusCode: false,
    });
  });
});

Cypress.Commands.add('addUserAuthorisePermission', (repoId, username) => {
  cy.getCSRFToken().then((csrfToken) => {
    cy.request({
      method: 'PATCH',
      url: `${getApiBaseUrl()}/api/v1/repo/${repoId}/user/authorise`,
      body: { username },
      headers: { 'X-CSRF-TOKEN': csrfToken },
      failOnStatusCode: false,
    });
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
    const gitServerTarget = Cypress.expose('GIT_SERVER_TARGET') || 'git-server:8443';
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

/**
 * Registers a repository through the API and yields the created record.
 */
Cypress.Commands.add('createTestRepo', (project, name, url) => {
  return cy.getCSRFToken().then((csrfToken) =>
    cy
      .request({
        method: 'POST',
        url: `${getApiBaseUrl()}/api/v1/repo`,
        body: { project, name, url },
        headers: { 'X-CSRF-TOKEN': csrfToken },
      })
      .its('body'),
  );
});

/**
 * Stubs the per-repository SCM metadata lookup so list and detail pages do not depend on the
 * upstream host being reachable for the made-up repositories the specs register.
 */
Cypress.Commands.add('stubScmMetadata', () => {
  cy.intercept('GET', '**/api/v1/repo/*/scm-metadata', { statusCode: 200, body: null });
});

/**
 * Enters a whole value into a search box in one input event, the way a paste does. The list pages
 * keep the search text in the URL, and Cypress types fast enough that keystrokes can land before the
 * previous URL update has rendered.
 */
Cypress.Commands.add('pasteInto', { prevSubject: 'element' }, ($input, value) => {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setValue.call($input[0], value);
  $input[0].dispatchEvent(new Event('input', { bubbles: true }));
  return cy.wrap($input).should('have.value', value);
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

/**
 * The cleanup helpers below call test-only endpoints that the API mounts when NODE_ENV=test (as in
 * the Docker Compose stack). Elsewhere the endpoints do not exist and the calls are no-ops, so
 * specs that use them must also tolerate data left over from earlier runs.
 */
Cypress.Commands.add('deleteTestPush', (pushId) => {
  cy.getCSRFToken().then((csrfToken) => {
    cy.request({
      method: 'DELETE',
      url: `${getApiBaseUrl()}/api/v1/test/push/${pushId}`,
      headers: { 'X-CSRF-TOKEN': csrfToken },
      failOnStatusCode: false,
    });
  });
});

Cypress.Commands.add('deleteTestUser', (username) => {
  cy.getCSRFToken().then((csrfToken) => {
    cy.request({
      method: 'DELETE',
      url: `${getApiBaseUrl()}/api/v1/test/user/${username}`,
      headers: { 'X-CSRF-TOKEN': csrfToken },
      failOnStatusCode: false,
    });
  });
});

/**
 * Mints a Forgejo access token for a seeded user from their password. The proxy identifies a
 * pusher by asking the upstream's API who the token belongs to, and that API does not accept a
 * password in the token's place, so pushes must present a token. Forgejo allows creating one
 * with plain basic auth. Token names must be unique per user, so each call mints its own.
 */
Cypress.Commands.add('mintUpstreamToken', (username, password) => {
  // Cypress 16 removed cy.exec(); mint via a Node task so we can ignore the
  // self-signed Forgejo certificate without shelling out to curl.
  return cy
    .task(
      'mintUpstreamToken',
      {
        username,
        password,
        gitServerUrl: Cypress.expose('GIT_SERVER_URL') || 'https://localhost:8443',
      },
      { timeout: 15000, log: false },
    )
    .then((token) => cy.wrap(token, { log: false }));
});

Cypress.Commands.add('createPush', (gitUser, gitPassword, gitEmail, uniqueSuffix) => {
  // Cypress 16 removed cy.exec(); the clone/commit/push sequence runs in Node.
  return cy.task(
    'createPush',
    {
      gitUser,
      gitPassword,
      gitEmail,
      uniqueSuffix,
      proxyUrl: Cypress.expose('GIT_PROXY_URL') || 'http://localhost:8000',
      gitServerTarget: Cypress.expose('GIT_SERVER_TARGET') || 'git-server:8443',
    },
    { timeout: 120000 },
  );
});
