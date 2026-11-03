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

describe('Repo Details - User Management', () => {
  const runId = Date.now();

  const testReviewer = {
    username: 'repo_detail_reviewer',
    password: 'reviewer123',
    email: 'repo_detail_reviewer@example.com',
  };

  const testContributor = {
    username: 'repo_detail_contributor',
    password: 'contributor123',
    email: 'repo_detail_contributor@example.com',
  };

  const nonAdminUser = {
    username: 'repo_detail_regular',
    password: 'regular123',
    email: 'repo_detail_regular@example.com',
  };

  const repoName = `cypress-repo-${runId}`;
  const repoUrl = `https://github.com/cypress-test/${repoName}.git`;
  let testRepoId = null;

  const addUserViaDialog = (type, username) => {
    cy.get(`[data-testid="add-user-btn-${type}"]`).click();
    cy.get('[data-testid="add-user-dialog"]').should('be.visible');
    cy.get('[data-testid="add-user-confirm-btn"]').should('be.disabled');
    // Typing key by key races Primer's inline autocomplete on slow runners and can drop
    // characters, so set the whole query in one input event once the user list has loaded.
    cy.get('[data-testid="add-user-dialog"]')
      .find('input')
      .should('be.enabled')
      .click()
      .pasteInto(username);
    cy.contains('[role="option"]', username).click();
    cy.get('[data-testid="add-user-confirm-btn"]').should('not.be.disabled').click();
    cy.get('[data-testid="add-user-dialog"]').should('not.exist');
  };

  before(() => {
    cy.login('admin', 'admin');
    cy.createUser(testReviewer.username, testReviewer.password, testReviewer.email);
    cy.createUser(testContributor.username, testContributor.password, testContributor.email);
    cy.createUser(nonAdminUser.username, nonAdminUser.password, nonAdminUser.email);
    cy.createTestRepo('cypress-test', repoName, repoUrl).then((repo) => {
      testRepoId = repo._id;
    });
    cy.logout();
  });

  after(() => {
    cy.login('admin', 'admin');
    if (testRepoId) {
      cy.deleteRepo(testRepoId);
    }
    cy.deleteTestUser(testReviewer.username);
    cy.deleteTestUser(testContributor.username);
    cy.deleteTestUser(nonAdminUser.username);
    cy.logout();
  });

  beforeEach(() => {
    cy.stubScmMetadata();
  });

  afterEach(() => {
    cy.logout();
  });

  it('Repo header renders project, name and URL', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}`);

    cy.get('[data-testid="repo-header"]').within(() => {
      cy.contains('cypress-test').should('be.visible');
      cy.contains('a', repoName).should('be.visible');
      cy.contains('a', `https://github.com/cypress-test/${repoName}`).should('be.visible');
    });
  });

  it('Reviewers tab renders the reviewers table', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}`);

    cy.get('[aria-label="Repository"]').contains('Reviewers').click();

    cy.url().should('include', 'tab=reviewers');
    cy.get('[data-testid="reviewers-table"]').should('be.visible');
  });

  it('Contributors tab renders the contributors table', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}`);

    cy.get('[aria-label="Repository"]').contains('Contributors').click();

    cy.url().should('include', 'tab=contributors');
    cy.get('[data-testid="contributors-table"]').should('be.visible');
  });

  it('Admin can add and remove a reviewer', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}?tab=reviewers`);

    addUserViaDialog('authorise', testReviewer.username);
    cy.get('[data-testid="reviewers-table"]').should('contain', testReviewer.username);

    cy.get('[data-testid="reviewers-table"]')
      .contains('tr', testReviewer.username)
      .find('button')
      .click();
    cy.get('[data-testid="reviewers-table"]').should('not.contain', testReviewer.username);
  });

  it('Admin can add and remove a contributor', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}?tab=contributors`);

    addUserViaDialog('push', testContributor.username);
    cy.get('[data-testid="contributors-table"]').should('contain', testContributor.username);

    cy.get('[data-testid="contributors-table"]')
      .contains('tr', testContributor.username)
      .find('button')
      .click();
    cy.get('[data-testid="contributors-table"]').should('not.contain', testContributor.username);
  });

  it('Non-admin cannot see add/remove/delete buttons', () => {
    cy.login('admin', 'admin');
    cy.addUserAuthorisePermission(testRepoId, testReviewer.username);
    cy.logout();

    cy.login(nonAdminUser.username, nonAdminUser.password);
    cy.visit(`/dashboard/repo/${testRepoId}?tab=reviewers`);

    cy.get('[data-testid="reviewers-table"]').should('contain', testReviewer.username);
    cy.get('[data-testid="delete-repo-button"]').should('not.exist');
    cy.get('[data-testid="add-user-btn-authorise"]').should('not.exist');
    cy.get('[data-testid="reviewers-table"]')
      .contains('tr', testReviewer.username)
      .find('button')
      .should('not.exist');
  });

  it('Code button shows the proxy clone URL', () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/repo/${testRepoId}`);

    cy.get('[data-testid="code-clone-btn"]').click();

    cy.contains(`/github.com/cypress-test/${repoName}.git`).should('be.visible');
    cy.get('[data-testid="repo-url"]').should('be.visible');
  });

  it('Delete repo dialog requires the repo name, then navigates to the repo list', () => {
    const deleteRepoName = `cypress-delete-repo-${runId}`;

    cy.login('admin', 'admin');
    cy.createTestRepo(
      'cypress-test',
      deleteRepoName,
      `https://github.com/cypress-test/${deleteRepoName}.git`,
    ).then((repo) => {
      cy.visit(`/dashboard/repo/${repo._id}`);
    });

    cy.get('[data-testid="delete-repo-button"]').click();
    cy.get('[data-testid="delete-repo-dialog"]').should('be.visible');
    cy.get('[data-testid="delete-repo-confirm-btn"]').should('be.disabled');

    cy.get('#delete-repo-confirm-input').type(deleteRepoName);
    cy.get('[data-testid="delete-repo-confirm-btn"]').should('not.be.disabled').click();

    cy.url().should('match', /\/dashboard\/repo$/);
    cy.get('[data-testid="repo-list-view"]').should('be.visible');
    cy.contains(`cypress-test/${deleteRepoName}`).should('not.exist');
  });
});
