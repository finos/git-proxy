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
    cy.window().then((win) => win.localStorage.clear());
  });
  it('JWT token field renders with show/hide toggle', () => {
    cy.visit('/dashboard/admin/settings');

    cy.get('[data-testid="jwt-token-input"]').should('be.visible');
    cy.get('[data-testid="jwt-token-toggle"]').should('be.visible');
  });
  it('Save button persists token and shows snackbar', () => {
    cy.visit('/dashboard/admin/settings');
    cy.get('[data-testid="jwt-token-input"]').find('input').type('test-jwt-token-12345');
    cy.get('[data-testid="jwt-save-btn"]').click();
    cy.contains('JWT token saved').should('be.visible');
  });
  it('Clear button removes token and shows snackbar', () => {
    cy.visit('/dashboard/admin/settings');
    cy.get('[data-testid="jwt-token-input"]').find('input').type('test-jwt-token-12345');
    cy.get('[data-testid="jwt-clear-btn"]').click();
    cy.contains('JWT token cleared').should('be.visible');
    cy.get('[data-testid="jwt-token-input"]').find('input').should('have.value', '');
  });
  it('Token persists across page reload', () => {
    cy.visit('/dashboard/admin/settings');

    cy.get('[data-testid="jwt-token-input"]').find('input').type('persistent-token-xyz');
    cy.get('[data-testid="jwt-save-btn"]').click();
    cy.contains('JWT token saved').should('be.visible');

    cy.reload();

    cy.get('[data-testid="jwt-token-input"]')
      .find('input')
      .should('have.value', 'persistent-token-xyz');
  });
});
