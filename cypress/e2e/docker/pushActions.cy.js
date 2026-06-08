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

describe('Push Actions (Approve, Reject, Cancel)', () => {
  const testUser = {
    username: 'testuser',
    password: 'user123',
    email: 'testuser@example.com',
    gitAccount: 'testuser',
  };

  const approverUser = {
    username: 'approver',
    password: 'approver123',
    email: 'approver@example.com',
    gitAccount: 'approver',
  };

  before(() => {
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

  describe('Approve flow', () => {
    beforeEach(() => {
      const suffix = `approve-${Date.now()}`;
      cy.createPush(testUser.username, testUser.password, testUser.email, suffix).as('pushId');
    });

    it('should approve a pending push via attestation dialog', function () {
      cy.login(approverUser.username, approverUser.password);
      cy.visit(`/dashboard/push/${this.pushId}`);

      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      cy.get('[data-testid="push-cancel-btn"]').should('be.visible');
      cy.get('[data-testid="push-reject-btn"]').should('be.visible');
      cy.get('[data-testid="attestation-open-btn"]').should('be.visible');

      cy.get('[data-testid="attestation-open-btn"]').click();
      cy.get('[data-testid="attestation-dialog"]').should('be.visible');

      cy.get('[data-testid="attestation-confirm-btn"]').should('be.disabled');

      cy.get('[data-testid="attestation-dialog"]')
        .find('input[type="checkbox"]')
        .each(($checkbox) => {
          cy.wrap($checkbox).check({ force: true });
        });

      cy.get('[data-testid="attestation-confirm-btn"]').should('not.be.disabled');
      cy.get('[data-testid="attestation-confirm-btn"]').click();

      cy.url().should('include', '/dashboard/push');
      cy.url().should('not.include', this.pushId);

      cy.visit(`/dashboard/push/${this.pushId}`);
      cy.get('[data-testid="push-status"]').should('contain', 'Approved');

      cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
      cy.get('[data-testid="push-reject-btn"]').should('not.exist');
      cy.get('[data-testid="attestation-open-btn"]').should('not.exist');
    });
  });

  describe('Reject flow', () => {
    beforeEach(() => {
      const suffix = `reject-${Date.now()}`;
      cy.createPush(testUser.username, testUser.password, testUser.email, suffix).as('pushId');
    });

    it('should reject a pending push', function () {
      cy.login(approverUser.username, approverUser.password);
      cy.visit(`/dashboard/push/${this.pushId}`);

      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      cy.get('[data-testid="push-reject-btn"]').click();

      cy.get('[data-testid="push-reject-confirm-btn"]').should('be.disabled');
      cy.get('#reason').type('Rejecting for test purposes');

      cy.get('[data-testid="push-reject-confirm-btn"]').should('not.be.disabled');
      cy.get('[data-testid="push-reject-confirm-btn"]').click();

      cy.url().should('include', '/dashboard/push');
      cy.url().should('not.include', this.pushId);

      cy.visit(`/dashboard/push/${this.pushId}`);
      cy.get('[data-testid="push-status"]').should('contain', 'Rejected');

      cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
      cy.get('[data-testid="push-reject-btn"]').should('not.exist');
      cy.get('[data-testid="attestation-open-btn"]').should('not.exist');
    });
  });

  describe('Cancel flow', () => {
    beforeEach(() => {
      const suffix = `cancel-${Date.now()}`;
      cy.createPush(testUser.username, testUser.password, testUser.email, suffix).as('pushId');
    });

    it('should cancel a pending push', function () {
      cy.login(testUser.username, testUser.password);
      cy.visit(`/dashboard/push/${this.pushId}`);

      cy.get('[data-testid="push-status"]').should('contain', 'Pending');
      cy.get('[data-testid="push-cancel-btn"]').click();

      cy.url().should('include', '/dashboard/push');

      cy.visit(`/dashboard/push/${this.pushId}`);
      cy.get('[data-testid="push-status"]').should('contain', 'Canceled');

      cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
      cy.get('[data-testid="push-reject-btn"]').should('not.exist');
      cy.get('[data-testid="attestation-open-btn"]').should('not.exist');
    });
  });

  describe('Negative: unauthorized approve', () => {
    beforeEach(() => {
      const suffix = `neg-approve-${Date.now()}`;
      cy.createPush(testUser.username, testUser.password, testUser.email, suffix).as('pushId');
    });

    it('should not change push state when user lacks canAuthorise permission', function () {
      cy.login(testUser.username, testUser.password);
      cy.visit(`/dashboard/push/${this.pushId}`);

      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      cy.get('[data-testid="attestation-open-btn"]').click();
      cy.get('[data-testid="attestation-dialog"]').should('be.visible');

      cy.get('[data-testid="attestation-dialog"]')
        .find('input[type="checkbox"]')
        .each(($checkbox) => {
          cy.wrap($checkbox).check({ force: true });
        });

      cy.get('[data-testid="attestation-confirm-btn"]').click();

      // TODO: Assert snackbar feedback when the UI handles 403 push action responses.
      cy.visit(`/dashboard/push/${this.pushId}`);
      cy.get('[data-testid="push-status"]').should('contain', 'Pending');
    });
  });

  describe('Negative: unauthorized reject', () => {
    beforeEach(() => {
      const suffix = `neg-reject-${Date.now()}`;
      cy.createPush(testUser.username, testUser.password, testUser.email, suffix).as('pushId');
    });

    it('should not change push state when user lacks canAuthorise permission', function () {
      cy.login(testUser.username, testUser.password);
      cy.visit(`/dashboard/push/${this.pushId}`);

      cy.get('[data-testid="push-status"]').should('contain', 'Pending');
      cy.get('[data-testid="push-reject-btn"]').click();

      // TODO: Assert snackbar feedback when the UI handles 403 push action responses.
      cy.visit(`/dashboard/push/${this.pushId}`);
      cy.get('[data-testid="push-status"]').should('contain', 'Pending');
    });
  });

  describe('Attestation dialog cancel does not cancel the push', () => {
    beforeEach(() => {
      const suffix = `dialog-cancel-${Date.now()}`;
      cy.createPush(testUser.username, testUser.password, testUser.email, suffix).as('pushId');
    });

    it('should close attestation dialog without affecting push status', function () {
      cy.login(approverUser.username, approverUser.password);
      cy.visit(`/dashboard/push/${this.pushId}`);

      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      cy.get('[data-testid="attestation-open-btn"]').click();
      cy.get('[data-testid="attestation-dialog"]').should('be.visible');

      cy.get('[data-testid="attestation-cancel-btn"]').click();

      cy.get('[data-testid="attestation-dialog"]').should('not.exist');
      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      cy.get('[data-testid="push-cancel-btn"]').should('be.visible');
      cy.get('[data-testid="push-reject-btn"]').should('be.visible');
      cy.get('[data-testid="attestation-open-btn"]').should('be.visible');
    });
  });
});
