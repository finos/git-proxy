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
    // Setup: login as admin, create test users, assign permissions
    cy.login('admin', 'admin');
    cy.visit('/'); // Ensure session cookies are active for cy.request calls

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

  describe('Approve flow', () => {
    let pushId;

    before(() => {
      const suffix = `approve-${Date.now()}`;
      cy.createPush(testUser.username, testUser.password, testUser.email, suffix).then((id) => {
        pushId = id;
      });
    });

    it('should approve a pending push via attestation dialog', () => {
      cy.login(approverUser.username, approverUser.password);
      cy.visit(`/dashboard/push/${pushId}`);

      // Verify push is Pending
      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      // Action buttons should be visible
      cy.get('[data-testid="push-cancel-btn"]').should('be.visible');
      cy.get('[data-testid="push-reject-btn"]').should('be.visible');
      cy.get('[data-testid="attestation-open-btn"]').should('be.visible');

      // Open attestation dialog
      cy.get('[data-testid="attestation-open-btn"]').click();
      cy.get('[data-testid="attestation-dialog"]').should('be.visible');

      // Confirm button should be disabled until all checkboxes are checked
      cy.get('[data-testid="attestation-confirm-btn"]').should('be.disabled');

      // Check all attestation checkboxes
      cy.get('[data-testid="attestation-dialog"]')
        .find('input[type="checkbox"]')
        .each(($checkbox) => {
          cy.wrap($checkbox).check({ force: true });
        });

      // Confirm button should now be enabled
      cy.get('[data-testid="attestation-confirm-btn"]').should('not.be.disabled');

      // Click confirm to approve
      cy.get('[data-testid="attestation-confirm-btn"]').click();

      // Should navigate back to push list
      cy.url().should('include', '/dashboard/push');
      cy.url().should('not.include', pushId);

      // Verify push is now Approved by revisiting its detail page
      cy.visit(`/dashboard/push/${pushId}`);
      cy.get('[data-testid="push-status"]').should('contain', 'Approved');

      // Action buttons should no longer be visible for an approved push
      cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
      cy.get('[data-testid="push-reject-btn"]').should('not.exist');
      cy.get('[data-testid="attestation-open-btn"]').should('not.exist');

      cy.logout();
    });
  });

  describe('Reject flow', () => {
    let pushId;

    before(() => {
      const suffix = `reject-${Date.now()}`;
      cy.createPush(testUser.username, testUser.password, testUser.email, suffix).then((id) => {
        pushId = id;
      });
    });

    it('should reject a pending push', () => {
      cy.login(approverUser.username, approverUser.password);
      cy.visit(`/dashboard/push/${pushId}`);

      // Verify push is Pending
      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      // Click Reject
      cy.get('[data-testid="push-reject-btn"]').click();

      // Should navigate back to push list
      cy.url().should('include', '/dashboard/push');
      cy.url().should('not.include', pushId);

      // Verify push is now Rejected
      cy.visit(`/dashboard/push/${pushId}`);
      cy.get('[data-testid="push-status"]').should('contain', 'Rejected');

      // Action buttons should no longer be visible
      cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
      cy.get('[data-testid="push-reject-btn"]').should('not.exist');
      cy.get('[data-testid="attestation-open-btn"]').should('not.exist');

      cy.logout();
    });
  });

  describe('Cancel flow', () => {
    let pushId;

    before(() => {
      const suffix = `cancel-${Date.now()}`;
      cy.createPush(testUser.username, testUser.password, testUser.email, suffix).then((id) => {
        pushId = id;
      });
    });

    it('should cancel a pending push', () => {
      // Cancel can be done by the push author
      cy.login(testUser.username, testUser.password);
      cy.visit(`/dashboard/push/${pushId}`);

      // Verify push is Pending
      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      // Click Cancel
      cy.get('[data-testid="push-cancel-btn"]').click();

      // Should navigate back to push list
      cy.url().should('include', '/dashboard/push');

      // Verify push is now Canceled
      cy.visit(`/dashboard/push/${pushId}`);
      cy.get('[data-testid="push-status"]').should('contain', 'Canceled');

      // Action buttons should no longer be visible
      cy.get('[data-testid="push-cancel-btn"]').should('not.exist');
      cy.get('[data-testid="push-reject-btn"]').should('not.exist');
      cy.get('[data-testid="attestation-open-btn"]').should('not.exist');

      cy.logout();
    });
  });

  describe('Negative: unauthorized approve', () => {
    let pushId;

    before(() => {
      const suffix = `neg-approve-${Date.now()}`;
      cy.createPush(testUser.username, testUser.password, testUser.email, suffix).then((id) => {
        pushId = id;
      });
    });

    it('should not change push state when user lacks canAuthorise permission', () => {
      // Login as testuser (has canPush but NOT canAuthorise)
      cy.login(testUser.username, testUser.password);
      cy.visit(`/dashboard/push/${pushId}`);

      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      // Open attestation dialog and attempt to approve
      cy.get('[data-testid="attestation-open-btn"]').click();
      cy.get('[data-testid="attestation-dialog"]').should('be.visible');

      // Check all checkboxes
      cy.get('[data-testid="attestation-dialog"]')
        .find('input[type="checkbox"]')
        .each(($checkbox) => {
          cy.wrap($checkbox).check({ force: true });
        });

      cy.get('[data-testid="attestation-confirm-btn"]').click();

      // TODO: The server correctly returns 403 but the UI (src/ui/services/git-push.ts)
      // only handles 401 errors in authorisePush/rejectPush. The 403 is silently
      // ignored and the user is navigated away without feedback. Once the UI properly
      // handles 403, this test should assert a snackbar error message is shown.
      cy.visit(`/dashboard/push/${pushId}`);
      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      cy.logout();
    });
  });

  describe('Negative: unauthorized reject', () => {
    let pushId;

    before(() => {
      const suffix = `neg-reject-${Date.now()}`;
      cy.createPush(testUser.username, testUser.password, testUser.email, suffix).then((id) => {
        pushId = id;
      });
    });

    it('should not change push state when user lacks canAuthorise permission', () => {
      // Login as testuser
      cy.login(testUser.username, testUser.password);
      cy.visit(`/dashboard/push/${pushId}`);

      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      // Click Reject
      cy.get('[data-testid="push-reject-btn"]').click();

      // TODO: Same issue as unauthorized approve — UI ignores 403 from server.
      // Once fixed, assert snackbar error message is shown.
      cy.visit(`/dashboard/push/${pushId}`);
      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      cy.logout();
    });
  });

  describe('Attestation dialog cancel does not cancel the push', () => {
    let pushId;

    before(() => {
      const suffix = `dialog-cancel-${Date.now()}`;
      cy.createPush(testUser.username, testUser.password, testUser.email, suffix).then((id) => {
        pushId = id;
      });
    });

    it('should close attestation dialog without affecting push status', () => {
      cy.login(approverUser.username, approverUser.password);
      cy.visit(`/dashboard/push/${pushId}`);

      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      // Open attestation dialog
      cy.get('[data-testid="attestation-open-btn"]').click();
      cy.get('[data-testid="attestation-dialog"]').should('be.visible');

      // Click the dialog's Cancel button (NOT the push cancel button)
      cy.get('[data-testid="attestation-cancel-btn"]').click();

      // Dialog should close, push should still be pending
      cy.get('[data-testid="attestation-dialog"]').should('not.exist');
      cy.get('[data-testid="push-status"]').should('contain', 'Pending');

      // Action buttons should still be visible (push is still pending)
      cy.get('[data-testid="push-cancel-btn"]').should('be.visible');
      cy.get('[data-testid="push-reject-btn"]').should('be.visible');
      cy.get('[data-testid="attestation-open-btn"]').should('be.visible');

      cy.logout();
    });
  });
});
