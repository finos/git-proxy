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
 * Profile Page
 * Strategy: Real API for all tests.
 */
describe('Profile Page', () => {
  const testUser = {
    username: 'profile_testuser',
    password: 'profile123',
    email: 'profile_testuser@example.com',
    gitAccount: 'profile_testuser',
  };

  const nonAdminUser = {
    username: 'profile_regular',
    password: 'regular123',
    email: 'profile_regular@example.com',
    gitAccount: 'profile_regular',
  };

  before(() => {
    cy.login('admin', 'admin');
    // Clean up stale users from previous interrupted runs before creating
    cy.deleteTestUser(testUser.username);
    cy.deleteTestUser(nonAdminUser.username);
    cy.createUser(testUser.username, testUser.password, testUser.email, testUser.gitAccount);
    cy.createUser(
      nonAdminUser.username,
      nonAdminUser.password,
      nonAdminUser.email,
      nonAdminUser.gitAccount,
    );
    // Verify users were created successfully
    cy.request({
      method: 'GET',
      url: `${Cypress.config('baseUrl')}/api/v1/user/${testUser.username}`,
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 200);
    cy.request({
      method: 'GET',
      url: `${Cypress.config('baseUrl')}/api/v1/user/${nonAdminUser.username}`,
      failOnStatusCode: false,
    })
      .its('status')
      .should('eq', 200);
    cy.logout();
  });

  after(() => {
    cy.login('admin', 'admin');
    cy.deleteTestUser(testUser.username);
    cy.deleteTestUser(nonAdminUser.username);
    cy.logout();
  });

  beforeEach(() => {
    cy.login('admin', 'admin');
  });

  afterEach(() => {
    cy.logout();
  });

  // --- 5.1 Displays user info ---
  it('5.1 — Displays user info: name, role, email, GitHub username, admin status', () => {
    cy.login('admin', 'admin');
    cy.visit('/dashboard/profile');

    cy.get('[data-testid="profile-name"]').should('be.visible');
    cy.get('[data-testid="profile-role"]').should('be.visible');
    cy.get('[data-testid="profile-email"]').should('be.visible');
    cy.get('[data-testid="profile-gitAccount"]').should('be.visible');
    cy.get('[data-testid="profile-admin-status"]').should('be.visible');
  });

  // --- 5.2 User can edit own GitHub username ---
  it('5.2 — User can edit their own GitHub username', () => {
    cy.login(testUser.username, testUser.password);
    cy.visit('/dashboard/profile');

    // Edit field and update button should be visible for own profile
    cy.get('[data-testid="gitAccount-input"]').should('be.visible');
    cy.get('[data-testid="update-profile-btn"]').should('be.visible');
  });

  // --- 5.3 Admin can edit another user's GitHub username ---
  it("5.3 — Admin can edit another user's GitHub username", () => {
    cy.login('admin', 'admin');
    cy.intercept('GET', `**/api/v1/user/${testUser.username}`).as('getUser');
    cy.visit(`/dashboard/user/${testUser.username}`);
    cy.wait('@getUser');

    // Wait for profile to render
    cy.get('[data-testid="profile-name"]', { timeout: 10000 }).should('be.visible');

    // Edit field and update button should be visible for admin viewing other user
    cy.get('[data-testid="gitAccount-input"]').should('be.visible');
    cy.get('[data-testid="update-profile-btn"]').should('be.visible');
  });

  // --- 5.4 Non-admin cannot edit other user ---
  it("5.4 — Non-admin viewing another user's profile cannot edit", () => {
    cy.login(nonAdminUser.username, nonAdminUser.password);
    cy.visit(`/dashboard/user/${testUser.username}`);

    // Edit field and update button should NOT be visible
    cy.get('[data-testid="gitAccount-input"]').should('not.exist');
    cy.get('[data-testid="update-profile-btn"]').should('not.exist');
  });
});
