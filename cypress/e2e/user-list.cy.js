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

describe('User List (Admin)', () => {
  const listedUser = {
    username: 'userlist_regular',
    password: 'regular123',
    email: 'userlist_regular@example.com',
  };

  before(() => {
    cy.login('admin', 'admin');
    cy.createUser(listedUser.username, listedUser.password, listedUser.email);
    cy.logout();
  });

  after(() => {
    cy.login('admin', 'admin');
    cy.deleteTestUser(listedUser.username);
    cy.logout();
  });

  afterEach(() => {
    cy.logout();
  });

  it('Renders the list of users', () => {
    cy.login('admin', 'admin');
    cy.visit('/dashboard/admin/user');

    cy.get('[data-testid="user-list-table"]').should('be.visible');
    cy.get('[aria-label="View profile for admin"]').should('be.visible');
    cy.get(`[aria-label="View profile for ${listedUser.username}"]`).should('be.visible');
  });

  it('Search filters users by username', () => {
    cy.login('admin', 'admin');
    cy.visit('/dashboard/admin/user');

    cy.get('[data-testid="search"]').find('input').pasteInto(listedUser.username);

    cy.url().should('include', `filter=${listedUser.username}`);
    cy.get('[data-testid="user-list-table"]').within(() => {
      cy.get(`[aria-label="View profile for ${listedUser.username}"]`).should('be.visible');
      cy.get('[aria-label="View profile for admin"]').should('not.exist');
    });
  });

  it('User rows link to the user profile', () => {
    cy.login('admin', 'admin');
    cy.visit('/dashboard/admin/user');

    cy.get(`[aria-label="View profile for ${listedUser.username}"]`).click();

    cy.url().should('include', `/dashboard/user/${listedUser.username}`);
    cy.get('[data-testid="profile-name"]').should('contain', listedUser.username);
  });

  it('Non-admin access follows the configured route rules', () => {
    cy.login(listedUser.username, listedUser.password);
    cy.visit('/dashboard/admin/user');

    cy.url().should('match', /\/(dashboard\/admin\/user|not-authorized|login)/);
  });
});
