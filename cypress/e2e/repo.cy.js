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

describe('Repo', () => {
  let cookies;
  let repoName;

  before(() => {
    cy.login('admin', 'admin');
    cy.cleanupTestRepos();
    cy.logout();
  });

  describe('Anonymous users', () => {
    beforeEach(() => {
      cy.visit('/dashboard/repo');
    });

    it('Prevents anonymous users from adding repos', () => {
      cy.get('[data-testid="repo-list-view"]')
        .find('[data-testid="add-repo-button"]')
        .should('not.exist');
    });
  });

  describe('Regular users', () => {
    beforeEach(() => {
      cy.login('user', 'user');

      cy.visit('/dashboard/repo');
    });

    after(() => {
      cy.logout();
    });

    it('Prevents regular users from adding repos', () => {
      cy.get('[data-testid="repo-list-view"]')
        .find('[data-testid="add-repo-button"]')
        .should('not.exist');
    });
  });

  describe('Admin users', () => {
    beforeEach(() => {
      cy.login('admin', 'admin');

      cy.visit('/dashboard/repo');
    });

    it('Admin users can add repos', () => {
      repoName = `${Date.now()}`;

      cy.get('[data-testid="repo-list-view"]').find('[data-testid="add-repo-button"]').click();

      cy.get('[data-testid="add-repo-dialog"]').within(() => {
        cy.get('[data-testid="repo-project-input"]').type('cypress-test');
        cy.get('[data-testid="repo-name-input"]').type(repoName);
        cy.get('[data-testid="repo-url-input"]').type(
          `https://github.com/cypress-test/${repoName}.git`,
        );
        cy.get('[data-testid="add-repo-button"]').click();
      });

      cy.contains('a', `cypress-test/${repoName}`, { timeout: 10000 }).click();
    });

    it('Displays an error when adding an existing repo', () => {
      cy.get('[data-testid="repo-list-view"]').find('[data-testid="add-repo-button"]').click();

      cy.get('[data-testid="add-repo-dialog"]').within(() => {
        cy.get('[data-testid="repo-project-input"]').type('finos');
        cy.get('[data-testid="repo-name-input"]').type('git-proxy');
        cy.get('[data-testid="repo-url-input"]').type('https://github.com/finos/git-proxy.git');
        cy.get('[data-testid="add-repo-button"]').click();
      });

      cy.get('[data-testid="repo-error"]')
        .should('be.visible')
        .and('contain.text', 'Repository https://github.com/finos/git-proxy.git already exists!');
    });
  });

  describe('Existing repo', () => {
    let cloneURL;
    let repoId;

    before(() => {
      cy.login('admin', 'admin');

      // Create a new repo
      cy.getCSRFToken().then((csrfToken) => {
        repoName = `${Date.now()}`;
        const gitProxyUrl = Cypress.env('GIT_PROXY_URL') || 'http://localhost:8000';
        cloneURL = `${gitProxyUrl}/github.com/cypress-test/${repoName}.git`;

        const apiBaseUrl = Cypress.env('API_BASE_URL') || Cypress.config('baseUrl');
        cy.request({
          method: 'POST',
          url: `${apiBaseUrl}/api/v1/repo`,
          body: {
            project: 'cypress-test',
            name: repoName,
            url: `https://github.com/cypress-test/${repoName}.git`,
          },
          headers: {
            cookie: cookies?.join('; ') || '',
            'X-CSRF-TOKEN': csrfToken,
          },
        }).then((res) => {
          expect(res.status).to.eq(200);
          repoId = res.body._id;
        });
      });
    });

    it('Opens tooltip with correct content and can copy', () => {
      cy.visit('/dashboard/repo');
      cy.on('uncaught:exception', () => false);

      const tooltipQuery = 'div[role="tooltip"]';

      // Check the tooltip isn't open to start with
      cy.get(tooltipQuery).should('not.exist');

      // Find the repo's Code button and click it
      cy.get(`a[href="/dashboard/repo/${repoId}"]`)
        .closest('tr')
        .find('span')
        .contains('Code')
        .should('exist')
        .click();

      // Check tooltip is open and contains the correct clone URL
      cy.get(tooltipQuery)
        .should('exist')
        .find('span')
        .contains(cloneURL)
        .should('exist')
        .parent()
        .find('span')
        .next()
        .get('svg.octicon-copy')
        .should('exist')
        .click();

      cy.get('svg.octicon-copy').should('not.exist');

      cy.get('svg.octicon-check').should('exist');
    });

    after(() => {
      // Delete the repo
      cy.getCSRFToken().then((csrfToken) => {
        cy.request({
          method: 'DELETE',
          url: `${Cypress.env('API_BASE_URL') || Cypress.config('baseUrl')}/api/v1/repo/${repoId}/delete`,
          headers: {
            cookie: cookies?.join('; ') || '',
            'X-CSRF-TOKEN': csrfToken,
          },
        });
      });
    });
  });

  describe('Pagination and search', () => {
    beforeEach(() => {
      cy.login('admin', 'admin');
      cy.visit('/dashboard/repo');
    });

    it('sends search param to API when typing in search box', () => {
      cy.intercept('GET', '**/api/v1/repo*').as('initialLoad');
      cy.wait('@initialLoad');

      cy.intercept('GET', '**/api/v1/repo*').as('searchRequest');
      cy.get('input[type="text"]').first().type('finos');

      cy.wait('@searchRequest').its('request.url').should('include', 'search=finos');
    });

    it('sends page=2 to API when clicking Next', () => {
      cy.intercept('GET', '**/api/v1/repo*').as('getRepos');

      cy.wait('@getRepos');

      cy.contains('button', 'Next').then(($btn) => {
        if (!$btn.is(':disabled')) {
          cy.intercept('GET', '**/api/v1/repo*').as('getReposPage2');
          cy.contains('button', 'Next').click();
          cy.wait('@getReposPage2').its('request.url').should('include', 'page=2');
        }
      });
    });

    it('sends updated limit to API when changing items per page', () => {
      cy.intercept('GET', '**/api/v1/repo*').as('getRepos');

      cy.wait('@getRepos');

      cy.intercept('GET', '**/api/v1/repo*').as('getReposLimited');

      cy.get('.paginationContainer').find('.MuiSelect-root').click();
      cy.get('[data-value="25"]').click();

      cy.wait('@getReposLimited').its('request.url').should('include', 'limit=25');
    });
  });
});
