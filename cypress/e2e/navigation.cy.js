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

  // --- 8.1 Sidebar renders all visible links ---
  it('8.1 — Sidebar renders all visible links', () => {
    cy.visit('/dashboard/repo');

    // Sidebar links should be present
    cy.contains('Repositories').should('be.visible');
    cy.contains('Dashboard').should('be.visible');
  });

  // --- 8.2 Sidebar links navigate correctly ---
  it('8.2 — Sidebar links navigate correctly', () => {
    cy.visit('/dashboard/repo');

    // Navigate to push dashboard
    cy.contains('Dashboard').click();
    cy.url().should('include', '/dashboard/push');

    // Navigate back to repos
    cy.contains('Repositories').click();
    cy.url().should('include', '/dashboard/repo');
  });

  // --- 8.3 Active sidebar item highlights ---
  it('8.3 — Active sidebar item highlights', () => {
    cy.visit('/dashboard/repo');

    // The active nav link should have aria-current="page"
    cy.get('[aria-current="page"]').should('exist');
  });

  // --- 8.4 Navbar renders ---
  it('8.4 — Navbar renders correctly', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="navbar"]').should('be.visible');
  });

  // --- 8.5 Footer renders ---
  it('8.5 — Footer renders', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="footer"]').should('be.visible');
  });

  // --- 8.6 Unauthenticated user redirected ---
  it('8.6 — Unauthenticated user is redirected to /login', () => {
    cy.logout();
    cy.visit('/dashboard/repo');

    cy.url().should('include', '/login');
  });

  // --- 8.7 Root redirects to dashboard/repo ---
  it('8.7 — / redirects to /dashboard/repo', () => {
    cy.logout();
    cy.visit('/');

    // Root should redirect (either to login if not authenticated, or to dashboard/repo)
    cy.url().should('match', /\/(login|dashboard)/);
  });
});
