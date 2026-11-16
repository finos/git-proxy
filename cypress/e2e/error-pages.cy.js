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

describe('Error Pages', () => {
  beforeEach(() => {
    cy.login('admin', 'admin');
  });

  afterEach(() => {
    cy.logout();
  });

  it('Unknown dashboard route shows the 404 page', () => {
    cy.visit('/dashboard/nonexistent-page-xyz');

    cy.get('[data-testid="dashboard-header"]').should('be.visible');
    cy.get('[data-testid="not-found-page"]').should('be.visible').and('contain', '404');
  });

  it('Unknown top-level route shows the 404 page', () => {
    cy.visit('/nonexistent-page-xyz');

    cy.get('[data-testid="not-found-page"]').should('be.visible').and('contain', '404');
  });

  it('404 page links back to home', () => {
    cy.visit('/dashboard/nonexistent-page-xyz');

    cy.get('[data-testid="not-found-page"]').contains('button', 'Go to home').click();
    cy.url().should('include', '/dashboard/repo');
  });

  it('Not authorized route shows the 403 page', () => {
    cy.logout();
    cy.login('user', 'user');
    cy.visit('/not-authorized');

    cy.get('[data-testid="not-authorized-page"]').should('be.visible').and('contain', '403');
  });
});
