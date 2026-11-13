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

describe('Settings Page', () => {
  beforeEach(() => {
    cy.login('admin', 'admin');
    cy.visit('/dashboard/admin/settings');
  });

  afterEach(() => {
    cy.logout();
  });

  it('JWT token field renders with show/hide toggle', () => {
    cy.get('#jwt-token').should('be.visible').and('have.attr', 'type', 'password');

    cy.get('[data-testid="jwt-token-toggle"]').click();
    cy.get('#jwt-token').should('have.attr', 'type', 'text');

    cy.get('[data-testid="jwt-token-toggle"]').click();
    cy.get('#jwt-token').should('have.attr', 'type', 'password');
  });

  it('Save button persists the token and shows a confirmation', () => {
    cy.get('#jwt-token').type('test-jwt-token-12345');
    cy.get('[data-testid="jwt-save-btn"]').click();

    cy.contains('JWT token saved').should('be.visible');
    cy.window()
      .its('localStorage')
      .invoke('getItem', 'ui_jwt_token')
      .should('eq', 'test-jwt-token-12345');
  });

  it('Clear button removes the token and shows a confirmation', () => {
    cy.get('#jwt-token').type('test-jwt-token-12345');
    cy.get('[data-testid="jwt-save-btn"]').click();
    cy.contains('JWT token saved').should('be.visible');

    cy.get('[data-testid="jwt-clear-btn"]').click();

    cy.contains('JWT token cleared').should('be.visible');
    cy.get('#jwt-token').should('have.value', '');
    cy.window().its('localStorage').invoke('getItem', 'ui_jwt_token').should('be.null');
  });

  it('Token persists across page reload', () => {
    cy.get('#jwt-token').type('persistent-token-xyz');
    cy.get('[data-testid="jwt-save-btn"]').click();
    cy.contains('JWT token saved').should('be.visible');

    cy.reload();

    cy.get('#jwt-token').should('have.value', 'persistent-token-xyz');
  });
});
