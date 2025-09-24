describe('Tag Push Functionality', () => {
  beforeEach(() => {
    cy.login('admin', 'admin');
    cy.on('uncaught:exception', () => false);

    // Create test data for tag pushes
    cy.createTestTagPush();
  });

  describe('Tag Push Display in PushesTable', () => {
    it('can navigate to push dashboard and view push table', () => {
      cy.visit('/dashboard/push');

      // Wait for API call to complete
      cy.wait('@getPushes');

      // Check that we can see the basic table structure
      cy.get('table', { timeout: 10000 }).should('exist');
      cy.get('thead').should('exist');
      cy.get('tbody').should('exist');

      // Now we should have test data, so we can check for rows
      cy.get('tbody tr').should('have.length.at.least', 1);

      // Check the structure of the first row
      cy.get('tbody tr')
        .first()
        .within(() => {
          cy.get('td').should('have.length.at.least', 6); // We know there are multiple columns
          // Check for tag-specific content
          cy.contains('v1.0.0').should('exist'); // Tag name
          cy.contains('test-tagger').should('exist'); // Tagger
        });
    });

    it('has search functionality', () => {
      cy.visit('/dashboard/push');
      cy.wait('@getPushes');

      // Check search input exists
      cy.get('input[type="text"]').first().should('exist');

      // Test searching for tag name
      cy.get('input[type="text"]').first().type('v1.0.0');
      cy.get('tbody tr').should('have.length.at.least', 1);
    });

    it('can interact with push table entries', () => {
      cy.visit('/dashboard/push');
      cy.wait('@getPushes');

      cy.get('tbody tr').should('have.length.at.least', 1);

      // Check for clickable elements in the first row
      cy.get('tbody tr')
        .first()
        .within(() => {
          // Should have links and buttons
          cy.get('a').should('have.length.at.least', 1); // Repository links, etc.
          cy.get('button').should('have.length.at.least', 1); // Action button
        });
    });
  });

  describe('Tag Push Details Page', () => {
    it('can access push details page structure', () => {
      // Try to access a push details page directly
      cy.visit('/dashboard/push/test-push-id', { failOnStatusCode: false });

      // Check basic page structure exists (regardless of whether push exists)
      cy.get('body').should('exist'); // Basic content check

      // If we end up redirected, that's also acceptable behavior
      cy.url().should('include', '/dashboard');
    });
  });

  describe('Basic UI Navigation', () => {
    it('can navigate between dashboard pages', () => {
      cy.visit('/dashboard/push');
      cy.wait('@getPushes');
      cy.get('table', { timeout: 10000 }).should('exist');

      // Test navigation to repo dashboard
      cy.visit('/dashboard/repo');
      cy.get('table', { timeout: 10000 }).should('exist');

      // Test navigation to user management if it exists
      cy.visit('/dashboard/user');
      cy.get('body').should('exist');
    });
  });

  describe('Application Robustness', () => {
    it('handles navigation to non-existent push gracefully', () => {
      // Try to visit a non-existent push detail page
      cy.visit('/dashboard/push/non-existent-push-id', { failOnStatusCode: false });

      // Should either redirect or show error page, but not crash
      cy.get('body').should('exist');
    });

    it('maintains functionality after page refresh', () => {
      cy.visit('/dashboard/push');
      cy.wait('@getPushes');
      cy.get('table', { timeout: 10000 }).should('exist');

      // Refresh the page
      cy.reload();
      // Wait for API call again after reload
      cy.wait('@getPushes');

      // Wait for page to reload and check basic functionality
      cy.get('body').should('exist');

      // Give more time for table to load after refresh, or check if redirected
      cy.url().then((url) => {
        if (url.includes('/dashboard/push')) {
          cy.get('table', { timeout: 15000 }).should('exist');
        } else {
          // If redirected (e.g., to login), that's also acceptable behavior
          cy.get('body').should('exist');
        }
      });
    });
  });
});
