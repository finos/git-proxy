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
 * Error Pages
 * Strategy: Direct navigation. No API needed.
 */
describe('Error Pages', () => {
  beforeEach(() => {
    cy.login('admin', 'admin');
  });

  afterEach(() => {
    cy.logout();
  });

  // --- 9.1 Unknown route shows 404 ---
  it('9.1 — Unknown route shows 404 page', () => {
    cy.visit('/dashboard/nonexistent-page-xyz');

    cy.get('[data-testid="not-found-page"]').should('be.visible');
    cy.contains('404').should('be.visible');
  });

  // --- 9.2 Unauthorized route shows NotAuthorized ---
  it('9.2 — Unauthorized route shows NotAuthorized page', () => {
    // Create a non-admin user and try to access admin route
    const regularUser = {
      username: `errorpage_user_${Date.now()}`,
      password: 'pass123',
      email: `errorpage_${Date.now()}@example.com`,
      gitAccount: `errorpage_git_${Date.now()}`,
    };

    cy.request({
      method: 'POST',
      url: `${Cypress.env('API_BASE_URL') || Cypress.config('baseUrl')}/api/auth/create-user`,
      body: regularUser,
      failOnStatusCode: false,
    });

    cy.logout();
    cy.login(regularUser.username, regularUser.password);
    cy.visit('/dashboard/admin/settings');

    // Should show not authorized page
    cy.get('[data-testid="not-authorized-page"]').should('be.visible');
    cy.contains('403').should('be.visible');

    // Clean up user
    cy.logout();
    cy.deleteTestUser(regularUser.username);
  });
});
