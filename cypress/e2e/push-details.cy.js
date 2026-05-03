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
    username: 'pushdetails_testuser',
    password: 'testuser123',
    email: 'pushdetails_testuser@example.com',
    gitAccount: 'pushdetails_testuser',
    gitUsername: 'testuser',
    gitPassword: 'user123',
  };

  const approverUser = {
    username: 'pushdetails_approver',
    password: 'approver123',
    email: 'pushdetails_approver@example.com',
    gitAccount: 'pushdetails_approver',
  };

  function waitForPushReady(pushId, attemptsRemaining = 10) {
    if (attemptsRemaining <= 0) {
      throw new Error(`Push ${pushId} not ready after max retries`);
    }

    return cy
      .request({
        method: 'GET',
        url: `${Cypress.config('baseUrl')}/api/v1/push/${pushId}`,
        failOnStatusCode: false,
        timeout: 10000,
      })
      .then((res) => {
        if (res.status === 200) {
          return;
        }

        if (res.status === 404) {
          // eslint-disable-next-line cypress/no-unnecessary-waiting
          cy.wait(500);
          return waitForPushReady(pushId, attemptsRemaining - 1);
        }

        throw new Error(`GET /api/v1/push/${pushId} returned unexpected status ${res.status}`);
      });
  }

  function visitPushDetails(pushId) {
    cy.intercept('GET', '**/api/auth/profile').as('getProfile');
    cy.intercept('GET', `**/api/v1/push/${pushId}`).as('getPush');
    cy.visit(`/dashboard/push/${pushId}`);
    cy.wait('@getProfile');
    cy.wait('@getPush', { timeout: 30000 });
  }

  beforeEach(() => {
    cy.login('admin', 'admin');

    cy.createUser(testUser.username, testUser.password, testUser.email, testUser.gitAccount);
    cy.createUser(
      approverUser.username,
      approverUser.password,
      approverUser.email,
      approverUser.gitAccount,
    );

    cy.getTestRepoId().then((repoId) => {
      cy.addUserPushPermission(repoId, testUser.username);
      cy.addUserAuthorisePermission(repoId, approverUser.username);
    });

    cy.logout();
  });

  afterEach(function () {
    if (this.pushId) {
      cy.deleteTestPush(this.pushId);
    }
    cy.logout();
  });

  after(() => {
    cy.deleteTestUser(testUser.username);
    cy.deleteTestUser(approverUser.username);
  });
  it('Pending push shows Pending status with action buttons', function () {
    const suffix = `pending-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).then(
      (pushId) => {
        this.pushId = pushId;
        waitForPushReady(pushId);
        cy.login('admin', 'admin');
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]').should('exist');
        cy.get('[data-testid="push-status"]').should('contain', 'Pending');
        cy.get('[data-testid="push-cancel-btn"]').should('be.visible');
        cy.get('[data-testid="push-reject-btn"]').should('be.visible');
        cy.get('[data-testid="attestation-open-btn"]').should('be.visible');
      },
    );
  });
  it('Card body renders Timestamp, Remote Head, Commit SHA, Repository, Branch', function () {
    const suffix = `info-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).then(
      (pushId) => {
        this.pushId = pushId;
        waitForPushReady(pushId);
        cy.login('admin', 'admin');
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]', { timeout: 15000 }).should('be.visible');
        cy.contains('h3', 'Timestamp', { timeout: 10000 }).should('be.visible');
        cy.contains('h3', 'Remote Head').should('be.visible');
        cy.contains('h3', 'Commit SHA').should('be.visible');
        cy.contains('h3', 'Repository').should('be.visible');
        cy.contains('h3', 'Branch').should('be.visible');
        cy.get('[data-testid="push-details-card-body"]').within(() => {
          cy.get('a').should('have.length.at.least', 3);
        });
      },
    );
  });
  it('Commits tab renders commit data table with correct columns', function () {
    const suffix = `commits-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).then(
      (pushId) => {
        this.pushId = pushId;
        waitForPushReady(pushId);
        cy.login('admin', 'admin');
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]').should('exist');
        cy.contains('Commits').click();
        cy.contains('Timestamp').should('exist');
        cy.contains('Committer').should('exist');
        cy.contains('Author').should('exist');
        cy.contains('Message').should('exist');
        cy.contains('cypress e2e test').should('exist');
      },
    );
  });
  it('Changes tab renders diff content via diff2html', function () {
    const suffix = `changes-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).then(
      (pushId) => {
        this.pushId = pushId;
        waitForPushReady(pushId);
        cy.login('admin', 'admin');
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]', { timeout: 15000 }).should('be.visible');
        cy.contains('Changes').click();
        cy.contains(`cypress-test-${suffix}.txt`, { timeout: 10000 }).should('be.visible');
      },
    );
  });
  it('Steps tab renders steps timeline with summary chips', function () {
    const suffix = `steps-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).then(
      (pushId) => {
        this.pushId = pushId;
        waitForPushReady(pushId);
        cy.login('admin', 'admin');
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]').should('exist');
        cy.contains('Steps').click();
        cy.contains('Push Validation Steps Summary').should('be.visible');
        cy.contains('Total Steps').should('be.visible');
        cy.get('[data-testid^="step-name-"]').should('have.length.at.least', 1);
      },
    );
  });
  it('Steps accordions expand and show content/logs', function () {
    const suffix = `accordion-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).then(
      (pushId) => {
        this.pushId = pushId;
        waitForPushReady(pushId);
        cy.login('admin', 'admin');
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]', { timeout: 15000 }).should('be.visible');
        cy.contains('Steps').click();
        cy.get('[data-testid^="step-name-"]', { timeout: 10000 }).should('have.length.at.least', 1);
        cy.get('[data-testid^="step-name-"]')
          .first()
          .then(($stepName) => {
            const stepName = $stepName.text();
            const testId = $stepName.attr('data-testid').replace('step-name-', 'step-details-');
            cy.contains(stepName).click({ force: true });
            cy.get(`[data-testid="${testId}"]`, { timeout: 10000 }).should('be.visible');
          });
      },
    );
  });
  it('Rejected push shows rejection info with reason', function () {
    const suffix = `reject-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).then(
      (pushId) => {
        this.pushId = pushId;
        waitForPushReady(pushId);
        cy.login(approverUser.username, approverUser.password);
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]').should('exist');
        cy.get('[data-testid="push-reject-btn"]').click();
        cy.get('#reason').type('Test rejection reason for Cypress');
        cy.get('[data-testid="push-reject-confirm-btn"]').click();
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]').should('contain', 'Rejected');
        cy.contains('rejected this contribution').should('be.visible');
        cy.contains('Reason').should('be.visible');
        cy.contains('Test rejection reason for Cypress').should('be.visible');
        cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
        cy.get('[data-testid="push-reject-btn"]').should('not.exist');
        cy.get('[data-testid="attestation-open-btn"]').should('not.exist');
      },
    );
  });
  it('Approved push shows attestation info', function () {
    const suffix = `approve-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).then(
      (pushId) => {
        this.pushId = pushId;
        waitForPushReady(pushId);
        cy.login(approverUser.username, approverUser.password);
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]').should('exist');
        cy.get('[data-testid="attestation-open-btn"]').click();
        cy.get('[data-testid="attestation-dialog"]').should('be.visible');
        cy.get('[data-testid="attestation-dialog"]')
          .find('input[type="checkbox"]')
          .each(($checkbox) => {
            cy.wrap($checkbox).check({ force: true });
          });
        cy.get('[data-testid="attestation-confirm-btn"]').click();
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]').should('contain', 'Approved');
        cy.contains('approved this contribution').should('be.visible');
        cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
        cy.get('[data-testid="push-reject-btn"]').should('not.exist');
        cy.get('[data-testid="attestation-open-btn"]').should('not.exist');
      },
    );
  });
  it('Error state renders error message when API fails', () => {
    cy.intercept('GET', '**/api/v1/push/nonexistent-push-id', {
      statusCode: 500,
      body: { message: 'Internal server error' },
    }).as('getPush');

    cy.login('admin', 'admin');
    cy.visit('/dashboard/push/nonexistent-push-id');
    cy.wait('@getPush');

    cy.contains('Something went wrong').should('be.visible');
  });
  it('Canceled push shows Canceled status', function () {
    const suffix = `cancel-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).then(
      (pushId) => {
        this.pushId = pushId;
        waitForPushReady(pushId);
        cy.login(testUser.username, testUser.password);
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]').should('exist');
        cy.get('[data-testid="push-cancel-btn"]').click();
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]').should('contain', 'Canceled');
        cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
        cy.get('[data-testid="push-reject-btn"]').should('not.exist');
        cy.get('[data-testid="attestation-open-btn"]').should('not.exist');
      },
    );
  });
  it('Action buttons navigate back to push list after completing action', function () {
    const suffix = `nav-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).then(
      (pushId) => {
        this.pushId = pushId;
        waitForPushReady(pushId);
        cy.login(testUser.username, testUser.password);
        visitPushDetails(pushId);
        cy.get('[data-testid="push-status"]').should('exist');
        cy.get('[data-testid="push-cancel-btn"]').click();
        cy.url().should('include', '/dashboard/push');
        cy.url().should('not.include', pushId);
      },
    );
  });
});
