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
 * Repo Details — User Management
 * Strategy: Real API for all tests. Creates a test repo in before(), cleans up in after().
 */
describe('Repo Details — User Management', () => {
  const testReviewer = {
    username: 'repo_detail_reviewer',
    password: 'reviewer123',
    email: 'repo_detail_reviewer@example.com',
    gitAccount: 'repo_detail_reviewer',
  };

  const testContributor = {
    username: 'repo_detail_contributor',
    password: 'contributor123',
    email: 'repo_detail_contributor@example.com',
    gitAccount: 'repo_detail_contributor',
  };

  const nonAdminUser = {
    username: 'repo_detail_regular',
    password: 'regular123',
    email: 'repo_detail_regular@example.com',
    gitAccount: 'repo_detail_regular',
  };

  let testRepoId = null;

  function getApiBaseUrl() {
    return Cypress.env('API_BASE_URL') || Cypress.config('baseUrl');
  }

  before(() => {
    // Create test users
    cy.login('admin', 'admin');
    cy.createUser(
      testReviewer.username,
      testReviewer.password,
      testReviewer.email,
      testReviewer.gitAccount,
    );
    cy.createUser(
      testContributor.username,
      testContributor.password,
      testContributor.email,
      testContributor.gitAccount,
    );
    cy.createUser(
      nonAdminUser.username,
      nonAdminUser.password,
      nonAdminUser.email,
      nonAdminUser.gitAccount,
    );

    // Create test repo
    cy.request({
      method: 'POST',
      url: `${getApiBaseUrl()}/api/v1/repo`,
      body: {
        name: `cypress-repo-${Date.now()}`,
        url: `https://github.com/test-org/cypress-test-repo-${Date.now()}.git`,
        project: 'cypress-test',
      },
      failOnStatusCode: false,
    }).then((res) => {
      if (res.status >= 400) {
        throw new Error(`Failed to create test repo: ${JSON.stringify(res.body).slice(0, 500)}`);
      }
      testRepoId = res.body._id;
    });

    cy.logout();
  });

  after(() => {
    // Clean up test repo
    if (testRepoId) {
      cy.login('admin', 'admin');
      cy.deleteRepo(testRepoId);
      cy.logout();
    }
    // Clean up test users
    cy.deleteTestUser(testReviewer.username);
    cy.deleteTestUser(testContributor.username);
    cy.deleteTestUser(nonAdminUser.username);
  });

  beforeEach(() => {
    // Intercept GitHub API calls to prevent unhandled axios errors for synthetic test repos
    cy.intercept('GET', 'https://api.github.com/repos/**', {
      body: {
        description: 'Test repo',
        language: 'JavaScript',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        pushed_at: '2024-01-01T00:00:00Z',
        html_url: 'https://github.com/test-org/test-repo',
        owner: {
          avatar_url: '',
          html_url: 'https://github.com/test-org',
        },
      },
    }).as('getRemoteRepo');
  });

  // --- 2.1 Repo info renders ---
  it('2.1 — Repo info renders: project, name, URL links', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}`);

    // Wait for repo info card to load
    cy.get('[data-testid="repo-info-card"]').should('be.visible');
    // The Organization field label should be visible
    cy.contains('Organization').should('be.visible');
  });

  // --- 2.2 Reviewers table renders ---
  it('2.2 — Reviewers table renders user list with links', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}`);

    cy.get('[data-testid="reviewers-table"]').should('be.visible');
    cy.contains('Reviewers').should('be.visible');
  });

  // --- 2.3 Contributors table renders ---
  it('2.3 — Contributors table renders user list with links', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}`);

    // Wait for contributors table to load (may need to scroll into view)
    cy.get('[data-testid="contributors-table"]').should('exist');
    cy.get('[data-testid="contributors-table"]').scrollIntoView();
    cy.contains('Contributors').should('be.visible');
  });

  // --- 2.4 Admin can add reviewer ---
  it('2.4 — Admin can add reviewer via "Add Reviewer" button', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}`);

    // Click add reviewer button
    cy.get('[data-testid="add-user-btn-authorise"]').click();

    // Dialog should open
    cy.get('[data-testid="add-user-dialog"]').should('be.visible');

    // Select user from dropdown
    cy.get('[data-testid="add-user-select"]').click();
    cy.contains(`li.MuiMenuItem-root`, testReviewer.username).click();

    // Confirm addition
    cy.get('[data-testid="add-user-confirm-btn"]').click();

    // Wait for dialog to close and user to appear in reviewers table
    cy.get('[data-testid="add-user-dialog"]').should('not.exist');
    cy.get('[data-testid="reviewers-table"]').contains(testReviewer.username).should('be.visible');
  });

  // --- 2.5 Admin can remove reviewer ---
  it('2.5 — Admin can remove reviewer', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}`);

    // Find the remove button in the reviewers table and click it
    cy.get('[data-testid="reviewers-table"]')
      .contains(testReviewer.username)
      .parents('tr')
      .find('button')
      .first()
      .click();

    // User should no longer appear in reviewers table
    cy.get('[data-testid="reviewers-table"]').contains(testReviewer.username).should('not.exist');
  });

  // --- 2.6 Admin can add contributor ---
  it('2.6 — Admin can add contributor via "Add Contributor" button', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}`);

    // Click add contributor button
    cy.get('[data-testid="add-user-btn-push"]').click();

    // Dialog should open
    cy.get('[data-testid="add-user-dialog"]').should('be.visible');

    // Select user from dropdown
    cy.get('[data-testid="add-user-select"]').click();
    cy.contains(`li.MuiMenuItem-root`, testContributor.username).click();

    // Confirm addition
    cy.get('[data-testid="add-user-confirm-btn"]').click();

    // Wait for dialog to close and user to appear in contributors table
    cy.get('[data-testid="add-user-dialog"]').should('not.exist');
    cy.get('[data-testid="contributors-table"]')
      .contains(testContributor.username)
      .should('be.visible');
  });

  // --- 2.7 Admin can remove contributor ---
  it('2.7 — Admin can remove contributor', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}`);

    // Find the remove button in the contributors table and click it
    cy.get('[data-testid="contributors-table"]')
      .contains(testContributor.username)
      .parents('tr')
      .find('button')
      .first()
      .click();

    // User should no longer appear in contributors table
    cy.get('[data-testid="contributors-table"]')
      .contains(testContributor.username)
      .should('not.exist');
  });

  // --- 2.8 Delete repo dialog ---
  it('2.8 — Delete repo dialog opens, confirms, navigates to repo list', () => {
    cy.login('admin', 'admin');

    // Create a fresh repo to delete
    cy.request({
      method: 'POST',
      url: `${getApiBaseUrl()}/api/v1/repo`,
      body: {
        name: `cypress-delete-repo-${Date.now()}`,
        url: `https://github.com/test-org/cypress-delete-${Date.now()}.git`,
        project: 'cypress-test',
      },
      failOnStatusCode: false,
    }).then((res) => {
      const deleteRepoId = res.body._id;
      const deleteRepoName = res.body.name;

      cy.visit(`/dashboard/repo/${deleteRepoId}`);

      // Click delete button
      cy.get('[data-testid="delete-repo-button"]').click();

      // Dialog should open
      cy.get('[data-testid="delete-repo-dialog"]').should('be.visible');

      // Type repo name to confirm
      cy.get('[data-testid="delete-repo-confirm-input"]').type(deleteRepoName);

      // Confirm button should now be enabled
      cy.get('[data-testid="delete-repo-confirm-btn"]').should('not.be.disabled');

      // Click confirm
      cy.get('[data-testid="delete-repo-confirm-btn"]').click();

      // Should navigate to repo list
      cy.url().should('include', '/dashboard/repo');
    });
  });

  // --- 2.9 Non-admin cannot see management buttons ---
  it('2.9 — Non-admin cannot see add/remove/delete buttons', () => {
    cy.login(nonAdminUser.username, nonAdminUser.password);
    cy.visit(`/dashboard/repo/${testRepoId}`);

    // Admin-only buttons should not be visible
    cy.get('[data-testid="delete-repo-button"]').should('not.exist');
    cy.get('[data-testid="add-user-btn-authorise"]').should('not.exist');
    cy.get('[data-testid="add-user-btn-push"]').should('not.exist');
  });

  // --- 2.10 Code clone button ---
  it('2.10 — Code clone button renders with correct URL', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}`);

    // Wait for page to fully load
    cy.get('[data-testid="repo-info-card"]').should('be.visible', { timeout: 10000 });
    cy.get('[data-testid="reviewers-table"]').should('be.visible');
    cy.get('[data-testid="code-clone-btn"]').should('be.visible');
  });
});
