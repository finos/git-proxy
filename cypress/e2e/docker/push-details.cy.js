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

describe('Push Details - Tabs & Content Rendering', () => {
  const testUser = {
    username: 'testuser',
    password: 'user123',
    email: 'testuser@example.com',
    // Upstream access token, minted in before(); pushes present this, not the password.
    upstreamToken: '',
  };

  const approverUser = {
    username: 'approver',
    password: 'approver123',
    email: 'approver@example.com',
  };

  const runId = Date.now();
  // Pending push shared by the read-only tests below. Tests that change push state create their own.
  const sharedSuffix = `details-${runId}`;
  let sharedPushId = '';

  function visitPushDetails(pushId, query = '') {
    cy.intercept('GET', `**/api/v1/push/${pushId}`).as('getPush');
    cy.visit(`/dashboard/push/${pushId}${query}`);
    cy.wait('@getPush');
    cy.get('[data-testid="push-status"]').should('be.visible');
  }

  function createPush(suffix) {
    return cy.createPush(testUser.username, testUser.upstreamToken, testUser.email, suffix);
  }

  before(() => {
    cy.login('admin', 'admin');

    cy.createUser(testUser.username, testUser.password, testUser.email, {
      'git-server': testUser.username,
    });
    cy.createUser(approverUser.username, approverUser.password, approverUser.email);

    cy.getTestRepoId().then((repoId) => {
      cy.addUserPushPermission(repoId, testUser.username);
      cy.addUserAuthorisePermission(repoId, approverUser.username);
    });

    cy.mintUpstreamToken(testUser.username, testUser.password).then((token) => {
      testUser.upstreamToken = token;
    });

    cy.logout();

    // Deferred so the push picks up the token minted above.
    cy.then(() => {
      createPush(sharedSuffix).then((pushId) => {
        sharedPushId = pushId;
      });
    });
  });

  afterEach(function () {
    if (this.pushId) {
      cy.login('admin', 'admin');
      cy.deleteTestPush(this.pushId);
    }
    cy.logout();
  });

  after(() => {
    cy.login('admin', 'admin');
    cy.deleteTestPush(sharedPushId);
    cy.deleteTestUser(testUser.username);
    cy.deleteTestUser(approverUser.username);
    cy.logout();
  });

  it('Pending push shows Pending status with action buttons', () => {
    cy.login('admin', 'admin');
    visitPushDetails(sharedPushId);

    cy.get('[data-testid="push-status"]').should('contain', 'Pending');
    cy.get('[data-testid="push-cancel-btn"]').should('be.visible');
    cy.get('[data-testid="push-reject-btn"]').should('be.visible');
    cy.get('[data-testid="attestation-open-btn"]').should('be.visible');
  });

  it('Header renders repository and branch, Commits tab renders the commit table', () => {
    cy.login('admin', 'admin');
    visitPushDetails(sharedPushId);

    cy.get('h1').should('contain', 'test-owner/test-repo').and('contain', 'main');
    cy.contains('Remote head').should('be.visible');
    cy.contains('Commit SHA').should('be.visible');

    ['Timestamp', 'SHA', 'Committer', 'Author', 'Message'].forEach((column) => {
      cy.contains('th', column).should('be.visible');
    });
    cy.contains(`cypress e2e test: ${sharedSuffix}`).should('be.visible');
  });

  it('Files changed tab renders the diff', () => {
    cy.login('admin', 'admin');
    visitPushDetails(sharedPushId);

    cy.get('[role="tab"]').contains('Files changed').click();

    cy.url().should('include', 'tab=files');
    cy.contains(`cypress-test-${sharedSuffix}.txt`).should('be.visible');
  });

  it('Steps tab renders the steps timeline and expands step details', () => {
    cy.login('admin', 'admin');
    visitPushDetails(sharedPushId);

    cy.get('[role="tab"]').contains('Steps').click();

    cy.url().should('include', 'tab=steps');
    cy.get('[data-testid^="step-name-"]').should('have.length.at.least', 1);
    // The push is waiting for approval, so the blocking step always has details to show.
    cy.get('[data-testid^="step-name-"][aria-expanded="false"]')
      .first()
      .then(($step) => {
        const detailsId = $step.attr('data-testid').replace('step-name-', 'step-details-');
        cy.wrap($step).click();
        cy.wrap($step).should('have.attr', 'aria-expanded', 'true');
        cy.get(`[data-testid="${detailsId}"]`).should('be.visible');
      });
  });

  it('Error state renders an error message when the API fails', () => {
    cy.intercept('GET', '**/api/v1/push/nonexistent-push-id', {
      statusCode: 500,
      body: { message: 'Internal server error' },
    }).as('getPush');

    cy.login('admin', 'admin');
    cy.visit('/dashboard/push/nonexistent-push-id');
    cy.wait('@getPush');

    cy.contains('Something went wrong').should('be.visible');
  });

  it('Rejected push shows rejection info with reason', () => {
    createPush(`reject-${runId}`).then((pushId) => {
      cy.wrap(pushId).as('pushId');

      cy.login(approverUser.username, approverUser.password);
      visitPushDetails(pushId);
      cy.get('[data-testid="push-reject-btn"]').click();
      cy.get('#push-reject-reason').type('Test rejection reason for Cypress');
      cy.get('[data-testid="push-reject-confirm-btn"]').click();
      cy.url().should('not.include', pushId);

      visitPushDetails(pushId);
      cy.get('[data-testid="push-status"]').should('contain', 'Rejected');
      cy.contains('rejected this contribution').should('be.visible');
      cy.contains('Reason').should('be.visible');
      cy.contains('Test rejection reason for Cypress').should('be.visible');
      cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
      cy.get('[data-testid="push-reject-btn"]').should('not.exist');
      cy.get('[data-testid="attestation-open-btn"]').should('not.exist');
    });
  });

  it('Approved push shows attestation info', () => {
    createPush(`approve-${runId}`).then((pushId) => {
      cy.wrap(pushId).as('pushId');

      cy.login(approverUser.username, approverUser.password);
      visitPushDetails(pushId);
      cy.get('[data-testid="attestation-open-btn"]').click();
      cy.get('[data-testid="attestation-dialog"]')
        .find('input[type="checkbox"]')
        .each(($checkbox) => {
          cy.wrap($checkbox).check({ force: true });
        });
      cy.get('[data-testid="attestation-confirm-btn"]').click();
      cy.url().should('not.include', pushId);

      visitPushDetails(pushId);
      cy.get('[data-testid="push-status"]').should('contain', 'Approved');
      cy.contains('approved this contribution').should('be.visible');
      cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
      cy.get('[data-testid="push-reject-btn"]').should('not.exist');
      cy.get('[data-testid="attestation-open-btn"]').should('not.exist');
    });
  });

  it('Canceling a push navigates back to the push list and shows Canceled status', () => {
    createPush(`cancel-${runId}`).then((pushId) => {
      cy.wrap(pushId).as('pushId');

      cy.login(testUser.username, testUser.password);
      visitPushDetails(pushId);
      cy.get('[data-testid="push-cancel-btn"]').click();

      cy.url().should('include', '/dashboard/push');
      cy.url().should('not.include', pushId);

      visitPushDetails(pushId);
      cy.get('[data-testid="push-status"]').should('contain', 'Canceled');
      cy.contains('Push request canceled').should('be.visible');
      cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
      cy.get('[data-testid="push-reject-btn"]').should('not.exist');
      cy.get('[data-testid="attestation-open-btn"]').should('not.exist');
    });
  });
});
