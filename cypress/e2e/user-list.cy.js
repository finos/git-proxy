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
 * User List (Admin)
 * Strategy: Real API. Tests cover only read access (create/delete UI not implemented).
 */
describe('User List (Admin)', () => {
  const nonAdminUser = {
    username: 'userlist_regular',
    password: 'regular123',
    email: 'userlist_regular@example.com',
    gitAccount: 'userlist_regular',
  };

  before(() => {
    cy.login('admin', 'admin');
    cy.createUser(
      nonAdminUser.username,
      nonAdminUser.password,
      nonAdminUser.email,
      nonAdminUser.gitAccount,
    );
    cy.logout();
  });

  after(() => {
    cy.deleteTestUser(nonAdminUser.username);
  });

  // --- 6.1 Renders list of all users ---
  it('6.1 — Renders list of all users', () => {
    cy.login('admin', 'admin');
    cy.visit('/dashboard/admin/user');

    cy.get('[data-testid="user-list-table"]').should('be.visible');

    // Admin user should be in the list
    cy.get('[data-testid="user-list-table"]').contains('admin').should('be.visible');
  });

  // --- 6.4 Non-admin cannot access ---
  it('6.4 — Non-admin cannot access user list', () => {
    cy.login(nonAdminUser.username, nonAdminUser.password);
    cy.visit('/dashboard/admin/user');

    // Should redirect to not authorized or show error
    cy.url().should('match', /\/(dashboard\/admin\/user|not-authorized|login)/);
  });
});
