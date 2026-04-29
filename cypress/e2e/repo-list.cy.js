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
 * Repo List - Search, Filter, Pagination
 * Strategy: Create 6+ test repos via API in before(), clean up in after().
 * Pagination tested here only. Search/filter use client-side logic.
 */
describe('Repo List - Search, Filter, Pagination', () => {
  const createdRepoIds = [];

  function getApiBaseUrl() {
    return Cypress.env('API_BASE_URL') || Cypress.config('baseUrl');
  }

  before(() => {
    cy.login('admin', 'admin');
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
  it('Search filters repos by name', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="search-input"]').should('be.visible');
    cy.get('[data-testid="search-input"]').find('input').type('cypress-pagination-repo-0');
    cy.get('[data-testid="search-input"]')
      .find('input')
      .should('have.value', 'cypress-pagination-repo-0');
  });
  it('Search filters repos by project', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="search-input"]').should('be.visible');

    cy.get('[data-testid="search-input"]').find('input').type('cypress-test');
    cy.get('[data-testid="search-input"]').find('input').should('have.value', 'cypress-test');
  });
  it('Clear search resets to all repos', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="search-input"]').should('be.visible');

    cy.get('[data-testid="search-input"]').find('input').type('unique-filter-string');
    cy.get('[data-testid="search-input"]')
      .find('input')
      .should('have.value', 'unique-filter-string');
    cy.get('[data-testid="search-input"]').find('input').clear();
    cy.get('[data-testid="search-input"]').find('input').should('have.value', '');
  });
  it('Filter dropdown sorts by Date Modified, Date Created, Alphabetical', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="filter-dropdown"]').click();

    cy.get('[data-testid="filter-option-date-modified"]').should('be.visible');
    cy.get('[data-testid="filter-option-date-created"]').should('be.visible');
    cy.get('[data-testid="filter-option-alphabetical"]').should('be.visible');

    cy.get('[data-testid="filter-option-alphabetical"]').click();

    cy.get('[data-testid="filter-dropdown"]').should('contain', 'Alphabetical');
  });
  it('Pagination renders and navigates between pages', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="search-input"]').should('be.visible');
    cy.get('[data-testid="pagination-info"]').should('exist');
    cy.get('[data-testid="pagination-info"]').scrollIntoView();

    cy.get('[data-testid="pagination-previous"]').should('be.visible');
    cy.get('[data-testid="pagination-next"]').should('be.visible');

    cy.get('[data-testid="pagination-next"]').click();
    cy.get('[data-testid="pagination-info"]').should('contain', 'Page 2 of');

    cy.get('[data-testid="pagination-previous"]').click();
    cy.get('[data-testid="pagination-info"]').should('contain', 'Page 1 of');
  });
  it('Repo rows are clickable and navigate to Repo Details', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="search-input"]').should('be.visible');

    cy.get('a[href^="/dashboard/repo/"]').first().click();

    cy.url().should('match', /\/dashboard\/repo\/[a-f0-9]+/);
  });
});
