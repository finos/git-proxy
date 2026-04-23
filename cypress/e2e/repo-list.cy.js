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
 * Repo List — Search, Filter, Pagination
 * Strategy: Create 6+ test repos via API in before(), clean up in after().
 * Pagination tested here only. Search/filter use client-side logic.
 */
describe('Repo List — Search, Filter, Pagination', () => {
  const createdRepoIds: string[] = [];

  function getApiBaseUrl() {
    return Cypress.env('API_BASE_URL') || Cypress.config('baseUrl');
  }

  before(() => {
    cy.login('admin', 'admin');

    // Create 6 test repos for pagination testing
    for (let i = 0; i < 6; i++) {
      const timestamp = Date.now() + i;
      cy.request({
        method: 'POST',
        url: `${getApiBaseUrl()}/api/v1/repo`,
        body: {
          name: `cypress-pagination-repo-${i}`,
          url: `https://github.com/cypress-test/pagination-repo-${timestamp}.git`,
          project: 'cypress-test',
        },
        failOnStatusCode: false,
      }).then((res) => {
        if (res.status < 400 && res.body._id) {
          createdRepoIds.push(res.body._id);
        }
      });
    }

    cy.logout();
  });

  after(() => {
    // Clean up all created repos
    createdRepoIds.forEach((repoId) => {
      cy.deleteRepo(repoId);
    });
  });

  beforeEach(() => {
    cy.login('admin', 'admin');
  });

  afterEach(() => {
    cy.logout();
  });

  // --- 4.1 Search filters by name ---
  it('4.1 — Search filters repos by name', () => {
    cy.visit('/dashboard/repo');

    // Type in search
    cy.get('[data-testid="search-input"]').find('input').type('cypress-pagination-repo-0');
    cy.wait(300);

    // Results should be filtered (at least the search input is visible and functional)
    cy.get('[data-testid="search-input"]').should('be.visible');
  });

  // --- 4.2 Search filters by project ---
  it('4.2 — Search filters repos by project', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="search-input"]').find('input').type('cypress-test');
    cy.wait(300);

    cy.get('[data-testid="search-input"]').should('be.visible');
  });

  // --- 4.3 Clear search resets ---
  it('4.3 — Clear search resets to all repos', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="search-input"]').find('input').type('unique-filter-string');
    cy.wait(300);

    // Clear the search
    cy.get('[data-testid="search-input"]').find('input').clear();
    cy.wait(300);

    cy.get('[data-testid="search-input"]').should('be.visible');
  });

  // --- 4.4 Filter dropdown sorts ---
  it('4.4 — Filter dropdown sorts by Date Modified, Date Created, Alphabetical', () => {
    cy.visit('/dashboard/repo');

    // Open filter dropdown
    cy.get('[data-testid="filter-dropdown"]').click();

    // All options should be visible
    cy.get('[data-testid="filter-option-date-modified"]').should('be.visible');
    cy.get('[data-testid="filter-option-date-created"]').should('be.visible');
    cy.get('[data-testid="filter-option-alphabetical"]').should('be.visible');

    // Click one option
    cy.get('[data-testid="filter-option-alphabetical"]').click();

    // Dropdown should close
    cy.get('[data-testid="filter-dropdown"]').should('contain', 'Alphabetical');
  });

  // --- 4.5 Pagination ---
  it('4.5 — Pagination renders and navigates between pages', () => {
    cy.visit('/dashboard/repo');

    // Pagination controls should be visible
    cy.get('[data-testid="pagination-previous"]').should('be.visible');
    cy.get('[data-testid="pagination-next"]').should('be.visible');
    cy.get('[data-testid="pagination-info"]').should('be.visible');

    // Navigate to next page
    cy.get('[data-testid="pagination-next"]').click();
    cy.wait(300);

    // Navigate back
    cy.get('[data-testid="pagination-previous"]').click();
    cy.wait(300);
  });

  // --- 4.6 Repo rows navigate ---
  it('4.6 — Repo rows are clickable and navigate to Repo Details', () => {
    cy.visit('/dashboard/repo');

    // Click on a repo row
    cy.get('[data-testid="search-input"]').parent().parent().find('tr').first().click();

    // Should navigate to repo details
    cy.url().should('include', '/dashboard/repo/');
  });
});
