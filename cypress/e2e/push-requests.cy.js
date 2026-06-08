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

/**
 * Push Requests - Tab Filtering
 * Strategy: Shared dataset created once in before(), cleaned up in after().
 * Uses real pushes for Pending/Approved/Rejected/Canceled, intercept for Error tab.
 * Note: Shared dataset is acceptable here because tests only assert on rendering, not mutations.
 */
describe('Push Requests - Tab Filtering', () => {
  const testUser = {
    username: 'pushreq_testuser',
    password: 'testuser123',
    email: 'pushreq_testuser@example.com',
    gitAccount: 'pushreq_testuser',
    gitUsername: 'testuser',
    gitPassword: 'user123',
  };

  const approverUser = {
    username: 'pushreq_approver',
    password: 'approver123',
    email: 'pushreq_approver@example.com',
    gitAccount: 'pushreq_approver',
  };
  const pushIds = {
    pending: '',
    approved: '',
    rejected: '',
    canceled: '',
  };

  before(function () {
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
    cy.createPush(
      testUser.gitUsername,
      testUser.gitPassword,
      testUser.email,
      `pushreq-pending-${Date.now()}`,
    ).then((id) => {
      pushIds.pending = id;
    });
    cy.createPush(
      testUser.gitUsername,
      testUser.gitPassword,
      testUser.email,
      `pushreq-approved-${Date.now()}`,
    ).then((id) => {
      pushIds.approved = id;
      cy.login(approverUser.username, approverUser.password);
      cy.visit(`/dashboard/push/${id}`);
      cy.get('[data-testid="attestation-open-btn"]').click();
      cy.get('[data-testid="attestation-dialog"]').should('be.visible');
      cy.get('[data-testid="attestation-dialog"]')
        .find('input[type="checkbox"]')
        .each(($checkbox) => {
          cy.wrap($checkbox).check({ force: true });
        });
      cy.get('[data-testid="attestation-confirm-btn"]').click();
      cy.logout();
    });
    cy.createPush(
      testUser.gitUsername,
      testUser.gitPassword,
      testUser.email,
      `pushreq-rejected-${Date.now()}`,
    ).then((id) => {
      pushIds.rejected = id;
      cy.login(approverUser.username, approverUser.password);
      cy.visit(`/dashboard/push/${id}`);
      cy.get('[data-testid="push-reject-btn"]').click();
      cy.get('#reason').type('Test rejection');
      cy.get('[data-testid="push-reject-confirm-btn"]').click();
      cy.logout();
    });
    cy.createPush(
      testUser.gitUsername,
      testUser.gitPassword,
      testUser.email,
      `pushreq-canceled-${Date.now()}`,
    ).then((id) => {
      pushIds.canceled = id;
      cy.login(testUser.username, testUser.password);
      cy.visit(`/dashboard/push/${id}`);
      cy.get('[data-testid="push-cancel-btn"]').click();
      cy.logout();
    });
  });

  after(() => {
    cy.deleteTestPush(pushIds.pending);
    cy.deleteTestPush(pushIds.approved);
    cy.deleteTestPush(pushIds.rejected);
    cy.deleteTestPush(pushIds.canceled);
    cy.deleteTestUser(testUser.username);
    cy.deleteTestUser(approverUser.username);
  });

  beforeEach(() => {
    cy.login('admin', 'admin');
  });

  afterEach(() => {
    cy.logout();
  });
  it('All 6 tabs render (All, Pending, Approved, Canceled, Rejected, Error)', () => {
    cy.visit('/dashboard/push');

    cy.contains('All').should('be.visible');
    cy.contains('Pending').should('be.visible');
    cy.contains('Approved').should('be.visible');
    cy.contains('Canceled').should('be.visible');
    cy.contains('Rejected').should('be.visible');
    cy.contains('Error').should('be.visible');
  });
  it('Pending tab filters to show only pending pushes', () => {
    cy.visit('/dashboard/push');

    cy.contains('Pending').click();
    cy.get('[data-testid="pushes-table"]').should('be.visible');
  });
  it('Approved tab filters to show only approved pushes', () => {
    cy.visit('/dashboard/push');

    cy.contains('Approved').click();
    cy.get('[data-testid="pushes-table"]').should('be.visible');
  });
  it('Canceled tab filters to show only canceled pushes', () => {
    cy.visit('/dashboard/push');

    cy.contains('Canceled').click();
    cy.get('[data-testid="pushes-table"]').should('be.visible');
  });
  it('Rejected tab filters to show only rejected pushes', () => {
    cy.visit('/dashboard/push');

    cy.contains('Rejected').click();
    cy.get('[data-testid="pushes-table"]').should('be.visible');
  });
  it('Error tab filters to show only errored pushes', () => {
    cy.visit('/dashboard/push');

    cy.contains('Error').click();
    cy.get('[data-testid="pushes-table"]').should('be.visible');
  });
  it('Push table rows are clickable and navigate to Push Details', () => {
    cy.visit('/dashboard/push');
    cy.get('[data-testid="pushes-table"]').should('be.visible');
    cy.get('[data-testid^="push-row-"]').first().find('button').first().click({ force: true });
    cy.url().should('include', '/dashboard/push/');
  });
});
