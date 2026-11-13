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

describe('Repo List - Search, Sort, Pagination', () => {
  // The list shows 20 repositories per page, so 21 matching repos give exactly two pages.
  const repoCount = 21;
  const prefix = `cypress-list-${Date.now()}`;
  const repoNames = Array.from(
    { length: repoCount },
    (_, i) => `${prefix}-${String(i).padStart(2, '0')}`,
  );
  const createdRepoIds = [];

  const repoLink = (name) => `a[href^="/dashboard/repo/"]:contains("cypress-test/${name}")`;

  before(() => {
    cy.login('admin', 'admin');
    repoNames.forEach((name) => {
      cy.createTestRepo('cypress-test', name, `https://github.com/cypress-test/${name}.git`).then(
        (repo) => {
          createdRepoIds.push(repo._id);
        },
      );
    });
    cy.logout();
  });

  after(() => {
    cy.login('admin', 'admin');
    createdRepoIds.forEach((repoId) => {
      cy.deleteRepo(repoId);
    });
    cy.logout();
  });

  beforeEach(() => {
    cy.stubScmMetadata();
    cy.login('admin', 'admin');
  });

  afterEach(() => {
    cy.logout();
  });

  it('Search filters repos by name', () => {
    cy.visit('/dashboard/repo');

    cy.get('[data-testid="search"]').find('input').pasteInto(repoNames[3]);

    cy.url().should('include', `filter=${repoNames[3]}`);
    cy.get('[data-testid="repo-list-view"]').should('contain', '1 repository');
    cy.get(repoLink(repoNames[3])).should('be.visible');
    cy.get(repoLink(repoNames[4])).should('not.exist');
  });

  it('Search filters repos by shared prefix', () => {
    cy.visit(`/dashboard/repo?filter=${prefix}`);

    cy.get('[data-testid="search"]').find('input').should('have.value', prefix);
    cy.get('[data-testid="repo-list-view"]').should('contain', `${repoCount} repositories`);
  });

  it('Clear search resets to all repos', () => {
    cy.visit(`/dashboard/repo?filter=${repoNames[0]}`);
    cy.get('[data-testid="repo-list-view"]').should('contain', '1 repository');

    cy.get('[data-testid="search"]').find('button').click();

    cy.get('[data-testid="search"]').find('input').should('have.value', '');
    cy.url().should('not.include', 'filter=');
    cy.get('[data-testid="pagination"]').should('be.visible');
  });

  it('Sort menu orders repos by name in both directions', () => {
    cy.visit(`/dashboard/repo?filter=${prefix}`);

    cy.get('[data-testid="repo-sort-menu"]').click();
    cy.get('[role="menuitemradio"]').contains('Name').click();
    cy.url().should('match', /sort=name-(asc|desc)/);

    cy.get('[data-testid="repo-sort-menu"]').click();
    cy.get('[role="menuitemradio"]').contains('Ascending').click();
    cy.url().should('include', 'sort=name-asc');
    cy.get('a[href^="/dashboard/repo/"]').first().should('contain', repoNames[0]);

    cy.get('[data-testid="repo-sort-menu"]').click();
    cy.get('[role="menuitemradio"]').contains('Descending').click();
    cy.url().should('include', 'sort=name-desc');
    cy.get('a[href^="/dashboard/repo/"]')
      .first()
      .should('contain', repoNames[repoCount - 1]);
  });

  it('Pagination renders and navigates between pages', () => {
    cy.visit(`/dashboard/repo?filter=${prefix}&sort=name-asc`);

    cy.get('[data-testid="pagination"]').should('be.visible');
    cy.get(repoLink(repoNames[0])).should('be.visible');
    cy.get(repoLink(repoNames[repoCount - 1])).should('not.exist');

    cy.get('[data-testid="pagination"]').contains('Next').click();

    cy.url().should('include', 'page=2');
    cy.get(repoLink(repoNames[repoCount - 1])).should('be.visible');
    cy.get(repoLink(repoNames[0])).should('not.exist');

    cy.get('[data-testid="pagination"]').contains('Previous').click();

    cy.url().should('not.include', 'page=2');
    cy.get(repoLink(repoNames[0])).should('be.visible');
  });

  it('Repo rows link to Repo Details', () => {
    cy.visit(`/dashboard/repo?filter=${repoNames[5]}`);

    cy.get(repoLink(repoNames[5])).click();

    cy.url().should('match', /\/dashboard\/repo\/[^/?]+$/);
    cy.get('[data-testid="repo-header"]').should('contain', repoNames[5]);
  });
});
