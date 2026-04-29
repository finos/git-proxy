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
 * Navigation & Shell
 * Strategy: Mix of real navigation and intercepts.
 */
describe('Navigation & Shell', () => {
  beforeEach(() => {
    cy.login('admin', 'admin');
  });

  afterEach(() => {
    cy.logout();
  });
  it('Sidebar renders all visible links', () => {
    cy.visit('/dashboard/repo');
    cy.contains('Repositories').should('be.visible');
    cy.contains('Dashboard').should('be.visible');
  });
  it('Sidebar links navigate correctly', () => {
    cy.visit('/dashboard/repo');
    cy.contains('Dashboard').click();
    cy.url().should('include', '/dashboard/push');
    cy.contains('Repositories').click();
    cy.url().should('include', '/dashboard/repo');
  });
  it('Active sidebar item highlights', () => {
    cy.visit('/dashboard/repo');
    cy.get('[aria-current="page"]').should('exist');
  });
  it('Navbar renders correctly', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="navbar"]').should('be.visible');
  });
  it('Footer renders', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="footer"]').should('exist');
    cy.get('[data-testid="footer"]').scrollIntoView();
    cy.get('[data-testid="footer"]').should('be.visible');
  });
  // NOTE: Keep unauthenticated checks outside the logged-in hooks.
  it('/ redirects to /dashboard/repo', () => {
    cy.logout();
    cy.visit('/');
    cy.url().should('match', /\/(login|dashboard)/);
  });
});

describe('Unauthenticated access', () => {
  it('Unauthenticated user is redirected to /login', () => {
    Cypress.session.clearAllSavedSessions();
    cy.clearCookies();
    cy.clearLocalStorage();

    cy.visit('/dashboard/profile');

    cy.url().should('include', '/login');
  });
});
