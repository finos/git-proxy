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

// start of a login command with sessions
// TODO: resolve issues with the CSRF token
Cypress.Commands.add('login', (username, password) => {
  cy.session([username, password], () => {
    cy.visit('/login');
    cy.intercept('GET', '**/api/auth/me').as('getUser');

    cy.get('[data-test=username]').type(username);
    cy.get('[data-test=password]').type(password);
    cy.get('[data-test=login]').click();

    cy.wait('@getUser');
    cy.url().should('include', '/dashboard/repo');
  });
});

Cypress.Commands.add('logout', () => {
  Cypress.session.clearAllSavedSessions();
});

Cypress.Commands.add('getCSRFToken', () => {
  return cy.request('GET', 'http://localhost:8080/api/v1/repo').then((res) => {
    let cookies = res.headers['set-cookie'];

    if (typeof cookies === 'string') {
      cookies = [cookies];
    }

    if (!cookies) {
      throw new Error('No cookies found in response');
    }

    const csrfCookie = cookies.find((c) => c.startsWith('csrf='));
    if (!csrfCookie) {
      throw new Error('No CSRF cookie found in response headers');
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
