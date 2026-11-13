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

describe('Navigation & Shell', () => {
  beforeEach(() => {
    cy.login('admin', 'admin');
  });

  afterEach(() => {
    cy.logout();
  });

  it('Navbar renders all visible links', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="dashboard-header"]').should('be.visible');
    cy.get('[data-testid="dashboard-nav-desktop-repositories"]').should('be.visible');
    cy.get('[data-testid="dashboard-nav-desktop-activity"]').should('be.visible');
    cy.get('[data-testid="dashboard-nav-desktop-users"]').should('be.visible');
    cy.get('[data-testid="dashboard-header-settings"]').should('be.visible');
  });

  it('Navbar links navigate correctly', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="dashboard-nav-desktop-activity"]').click();
    cy.url().should('include', '/dashboard/push');

    cy.get('[data-testid="dashboard-nav-desktop-users"]').click();
    cy.url().should('include', '/dashboard/admin/user');

    cy.get('[data-testid="dashboard-header-settings"]').click();
    cy.url().should('include', '/dashboard/admin/settings');

    cy.get('[data-testid="dashboard-nav-desktop-repositories"]').click();
    cy.url().should('include', '/dashboard/repo');
  });

  it('Active navbar item is highlighted', () => {
    cy.visit('/dashboard/push');

    cy.get('[data-testid="dashboard-nav-desktop-activity"]').should(
      'have.attr',
      'aria-current',
      'page',
    );
    cy.get('[data-testid="dashboard-nav-desktop-repositories"]').should(
      'not.have.attr',
      'aria-current',
    );
  });

  it('Footer renders', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="footer"]').scrollIntoView();
    cy.get('[data-testid="footer"]').should('be.visible').and('contain', 'GitProxy');
  });

  it('/ redirects to the repository list', () => {
    cy.visit('/');

    cy.url().should('include', '/dashboard/repo');
  });
});

describe('Unauthenticated access', () => {
  it('Unauthenticated user is redirected to /login from the profile page', () => {
    cy.logout();
    cy.visit('/dashboard/profile');

    cy.url().should('include', '/login');
  });
});
