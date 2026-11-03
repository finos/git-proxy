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

describe('Profile Page', () => {
  const testUser = {
    username: 'profile_testuser',
    password: 'profile123',
    email: 'profile_testuser@example.com',
  };

  const nonAdminUser = {
    username: 'profile_regular',
    password: 'regular123',
    email: 'profile_regular@example.com',
  };

  const profileSections = '[aria-label="Profile sections"]';

  before(() => {
    cy.login('admin', 'admin');
    cy.createUser(testUser.username, testUser.password, testUser.email);
    cy.createUser(nonAdminUser.username, nonAdminUser.password, nonAdminUser.email);
    cy.logout();
  });

  after(() => {
    cy.login('admin', 'admin');
    cy.deleteTestUser(testUser.username);
    cy.deleteTestUser(nonAdminUser.username);
    cy.logout();
  });

  afterEach(() => {
    cy.logout();
  });

  it('Displays user info: name, email and admin status', () => {
    cy.login('admin', 'admin');
    cy.visit('/dashboard/profile');

    cy.get('[data-testid="profile-name"]').should('contain', 'admin');
    cy.get('[data-testid="profile-email"]').should('be.visible');
    cy.get('[data-testid="profile-admin-status"]').should('contain', 'Admin');
  });

  it('Non-admin profile has no admin badge', () => {
    cy.login(testUser.username, testUser.password);
    cy.visit('/dashboard/profile');

    cy.get('[data-testid="profile-name"]').should('contain', testUser.username);
    cy.get('[data-testid="profile-email"]').should('contain', testUser.email);
    cy.get('[data-testid="profile-admin-status"]').should('not.exist');
  });

  it('User can open the settings of their own profile', () => {
    cy.login(testUser.username, testUser.password);
    cy.visit('/dashboard/profile');

    cy.get(profileSections).contains('Settings').click();
    cy.get('[data-testid="linked-accounts"]')
      .should('be.visible')
      .and('contain', 'Linked accounts');
  });

  it("Admin can open the settings of another user's profile", () => {
    cy.login('admin', 'admin');
    cy.visit(`/dashboard/user/${testUser.username}`);

    cy.get('[data-testid="profile-name"]').should('contain', testUser.username);
    cy.get(profileSections).contains('Settings').click();
    cy.get('[data-testid="linked-accounts"]').should('be.visible');
  });

  it("Non-admin viewing another user's profile cannot edit it", () => {
    cy.login(nonAdminUser.username, nonAdminUser.password);
    cy.visit(`/dashboard/user/${testUser.username}`);

    cy.get('[data-testid="profile-name"]').should('contain', testUser.username);
    cy.get(profileSections).should('not.exist');
    cy.get('[data-testid="linked-accounts"]').should('not.exist');
  });
});
