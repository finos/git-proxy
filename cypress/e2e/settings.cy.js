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
 * Settings Page
 * Strategy: Uses localStorage for JWT persistence. No backend API calls for save/clear.
 */
describe('Settings Page', () => {
  beforeEach(() => {
    cy.login('admin', 'admin');
  });

  afterEach(() => {
    cy.logout();
    // Clear localStorage to avoid state leaking between tests
    cy.window().then((win) => win.localStorage.clear());
  });

  // --- 7.1 JWT token field renders ---
  it('7.1 — JWT token field renders with show/hide toggle', () => {
    cy.visit('/dashboard/admin/settings');

    cy.get('[data-testid="jwt-token-input"]').should('be.visible');
    cy.get('[data-testid="jwt-token-toggle"]').should('be.visible');
  });

  // --- 7.2 Save button persists token ---
  it('7.2 — Save button persists token and shows snackbar', () => {
    cy.visit('/dashboard/admin/settings');

    // Enter a test token
    cy.get('[data-testid="jwt-token-input"]').find('input').type('test-jwt-token-12345');

    // Click save
    cy.get('[data-testid="jwt-save-btn"]').click();

    // Snackbar should appear
    cy.contains('JWT token saved').should('be.visible');
  });

  // --- 7.3 Clear button removes token ---
  it('7.3 — Clear button removes token and shows snackbar', () => {
    cy.visit('/dashboard/admin/settings');

    // Enter a test token
    cy.get('[data-testid="jwt-token-input"]').find('input').type('test-jwt-token-12345');

    // Click clear
    cy.get('[data-testid="jwt-clear-btn"]').click();

    // Snackbar should appear
    cy.contains('JWT token cleared').should('be.visible');

    // Token field should be empty
    cy.get('[data-testid="jwt-token-input"]').find('input').should('have.value', '');
  });

  // --- 7.4 Token persists across reload ---
  it('7.4 — Token persists across page reload', () => {
    cy.visit('/dashboard/admin/settings');

    // Enter and save a token
    cy.get('[data-testid="jwt-token-input"]').find('input').type('persistent-token-xyz');
    cy.get('[data-testid="jwt-save-btn"]').click();
    // eslint-disable-next-line cypress/no-unnecessary-waiting
    cy.wait(500);

    // Reload page
    cy.reload();

    // Token should still be present
    cy.get('[data-testid="jwt-token-input"]')
      .find('input')
      .should('have.value', 'persistent-token-xyz');
  });
});
