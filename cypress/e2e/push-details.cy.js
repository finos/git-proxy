/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

describe('Push Details — Tabs & Content Rendering', () => {
  const testUser = {
    username: 'pushdetails_testuser',
    password: 'testuser123',
    email: 'pushdetails_testuser@example.com',
    gitAccount: 'pushdetails_testuser',
    // Git credentials must match a user on the git server for cy.createPush() to work
    gitUsername: 'testuser',
    gitPassword: 'user123',
  };

  const approverUser = {
    username: 'pushdetails_approver',
    password: 'approver123',
    email: 'pushdetails_approver@example.com',
    gitAccount: 'pushdetails_approver',
  };

  beforeEach(() => {
    cy.login('admin', 'admin');

    // Ensure test users exist and have permissions on the test repo
    cy.createUser(testUser.username, testUser.password, testUser.email, testUser.gitAccount);
    cy.createUser(approverUser.username, approverUser.password, approverUser.email, approverUser.gitAccount);

    cy.getTestRepoId().then((repoId) => {
      cy.addUserPushPermission(repoId, testUser.username);
      cy.addUserAuthorisePermission(repoId, approverUser.username);
    });

    cy.logout();
  });

  afterEach(function () {
    // Clean up push created in this test (if any)
    if (this.pushId) {
      cy.deleteTestPush(this.pushId);
    }
    cy.logout();
  });

  after(() => {
    // Clean up test users
    cy.deleteTestUser(testUser.username);
    cy.deleteTestUser(approverUser.username);
  });

  // --- 1.1 Pending push shows Pending status ---
  it('1.1 — Pending push shows Pending status with action buttons', function () {
    const suffix = `pending-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).as('pushId');

    cy.login('admin', 'admin');
    cy.visit(`/dashboard/push/${this.pushId}`);

    // Status should be Pending
    cy.get('[data-testid="push-status"]').should('contain', 'Pending');

    // Action buttons should be visible for pending push
    cy.get('[data-testid="push-cancel-btn"]').should('be.visible');
    cy.get('[data-testid="push-reject-btn"]').should('be.visible');
    cy.get('[data-testid="attestation-open-btn"]').should('be.visible');
  });

  // --- 1.2 Card body renders info fields with correct links ---
  it('1.2 — Card body renders Timestamp, Remote Head, Commit SHA, Repository, Branch', function () {
    const suffix = `info-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).as('pushId');

    cy.login('admin', 'admin');
    cy.visit(`/dashboard/push/${this.pushId}`);

    // All info labels should be visible
    cy.contains('h3', 'Timestamp').should('be.visible');
    cy.contains('h3', 'Remote Head').should('be.visible');
    cy.contains('h3', 'Commit SHA').should('be.visible');
    cy.contains('h3', 'Repository').should('be.visible');
    cy.contains('h3', 'Branch').should('be.visible');

    // Links should exist (we can't predict exact commit SHAs but links should be present)
    cy.get('CardBody').within(() => {
      cy.get('a').should('have.length.at.least', 3); // At least commit links + repo + branch
    });
  });

  // --- 1.3 Commits tab renders commit data table ---
  it('1.3 — Commits tab renders commit data table with correct columns', function () {
    const suffix = `commits-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).as('pushId');

    cy.login('admin', 'admin');
    cy.visit(`/dashboard/push/${this.pushId}`);

    // Commits tab is the default first tab - table headers should be visible
    cy.contains('Timestamp').should('be.visible');
    cy.contains('Committer').should('be.visible');
    cy.contains('Author').should('be.visible');
    cy.contains('Message').should('be.visible');

    // Our test push has a commit with a known message pattern
    cy.contains('cypress e2e test').should('be.visible');
  });

  // --- 1.4 Changes tab renders diff content ---
  it('1.4 — Changes tab renders diff content via diff2html', function () {
    const suffix = `changes-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).as('pushId');

    cy.login('admin', 'admin');
    cy.visit(`/dashboard/push/${this.pushId}`);

    // Click the Changes tab
    cy.contains('Changes').click();
    cy.wait(500);

    // diff2html should render the file we created
    cy.contains(`cypress-test-${suffix}.txt`).should('be.visible');
  });

  // --- 1.5 Steps tab renders steps timeline with summary ---
  it('1.5 — Steps tab renders steps timeline with summary chips', function () {
    const suffix = `steps-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).as('pushId');

    cy.login('admin', 'admin');
    cy.visit(`/dashboard/push/${this.pushId}`);

    // Click the Steps tab
    cy.contains('Steps').click();
    cy.wait(500);

    // Summary header should be visible
    cy.contains('Push Validation Steps Summary').should('be.visible');

    // Total steps chip should be visible
    cy.contains('Total Steps').should('be.visible');

    // At least one step name should be visible
    cy.get('.stepName').should('have.length.at.least', 1);
  });

  // --- 1.6 Steps accordions expand and show content/logs ---
  it('1.6 — Steps accordions expand and show content/logs', function () {
    const suffix = `accordion-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).as('pushId');

    cy.login('admin', 'admin');
    cy.visit(`/dashboard/push/${this.pushId}`);

    // Click the Steps tab
    cy.contains('Steps').click();
    cy.wait(500);

    // Find and expand a step accordion (non-large steps are expandable)
    cy.get('.stepName').first().then(($stepName) => {
      const stepName = $stepName.text();
      // Click to expand (skip large steps like 'diff' and 'writePack' which are disabled)
      cy.contains(stepName).click({ force: true });

      // After expanding, details should be visible
      // Either content/logs or the "completed successfully" message
      cy.get('.stepDetails').should('be.visible');
    });
  });

  // --- 1.7 Rejected push shows rejection info with reason ---
  it('1.7 — Rejected push shows rejection info with reason', function () {
    const suffix = `reject-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).as('pushId');

    cy.login(approverUser.username, approverUser.password);
    cy.visit(`/dashboard/push/${this.pushId}`);

    // Reject the push
    cy.get('[data-testid="push-reject-btn"]').click();
    cy.get('#reason').type('Test rejection reason for Cypress');
    cy.get('[data-testid="push-reject-confirm-btn"]').click();

    // Navigate back to the push details
    cy.visit(`/dashboard/push/${this.pushId}`);

    // Status should be Rejected
    cy.get('[data-testid="push-status"]').should('contain', 'Rejected');

    // Rejection info should be visible
    cy.contains('rejected this contribution').should('be.visible');

    // Reason should be displayed
    cy.contains('Reason').should('be.visible');
    cy.contains('Test rejection reason for Cypress').should('be.visible');

    // Action buttons should NOT be visible for rejected push
    cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
    cy.get('[data-testid="push-reject-btn"]').should('not.exist');
    cy.get('[data-testid="attestation-open-btn"]').should('not.exist');
  });

  // --- 1.8 Approved push shows attestation info ---
  it('1.8 — Approved push shows attestation info', function () {
    const suffix = `approve-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).as('pushId');

    cy.login(approverUser.username, approverUser.password);
    cy.visit(`/dashboard/push/${this.pushId}`);

    // Approve the push
    cy.get('[data-testid="attestation-open-btn"]').click();
    cy.get('[data-testid="attestation-dialog"]').should('be.visible');

    // Check all attestation checkboxes
    cy.get('[data-testid="attestation-dialog"]')
      .find('input[type="checkbox"]')
      .each(($checkbox) => {
        cy.wrap($checkbox).check({ force: true });
      });

    cy.get('[data-testid="attestation-confirm-btn"]').click();

    // Navigate back to the push details
    cy.visit(`/dashboard/push/${this.pushId}`);

    // Status should be Approved
    cy.get('[data-testid="push-status"]').should('contain', 'Approved');

    // Attestation info should be visible
    cy.contains('approved this contribution').should('be.visible');

    // Action buttons should NOT be visible for approved push
    cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
    cy.get('[data-testid="push-reject-btn"]').should('not.exist');
    cy.get('[data-testid="attestation-open-btn"]').should('not.exist');
  });

  // --- 1.9 Error state renders error message when API fails ---
  it('1.9 — Error state renders error message when API fails', () => {
    // Use intercept for error state - can't easily trigger real 500 errors
    cy.intercept('GET', '**/api/v1/push/nonexistent-push-id', {
      statusCode: 500,
      body: { message: 'Internal server error' },
    }).as('getPush');

    cy.login('admin', 'admin');
    cy.visit('/dashboard/push/nonexistent-push-id');
    cy.wait('@getPush');

    // Should show error state
    cy.contains('Something went wrong').should('be.visible');
  });

  // --- 1.10 Canceled push shows Canceled status ---
  it('1.10 — Canceled push shows Canceled status', function () {
    const suffix = `cancel-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).as('pushId');

    cy.login(testUser.username, testUser.password);
    cy.visit(`/dashboard/push/${this.pushId}`);

    // Cancel the push
    cy.get('[data-testid="push-cancel-btn"]').click();

    // Navigate back to the push details
    cy.visit(`/dashboard/push/${this.pushId}`);

    // Status should be Canceled
    cy.get('[data-testid="push-status"]').should('contain', 'Canceled');

    // Action buttons should NOT be visible for canceled push
    cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
    cy.get('[data-testid="push-reject-btn"]').should('not.exist');
    cy.get('[data-testid="attestation-open-btn"]').should('not.exist');
  });

  // --- 1.11 Push details page navigates back to push list after action ---
  it('1.11 — Action buttons navigate back to push list after completing action', function () {
    const suffix = `nav-${Date.now()}`;
    cy.createPush(testUser.gitUsername, testUser.gitPassword, testUser.email, suffix).as('pushId');

    cy.login(testUser.username, testUser.password);
    cy.visit(`/dashboard/push/${this.pushId}`);

    // Cancel the push
    cy.get('[data-testid="push-cancel-btn"]').click();

    // Should navigate back to push list
    cy.url().should('include', '/dashboard/push');
    cy.url().should('not.include', this.pushId);
  });
});
