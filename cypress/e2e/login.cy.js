/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.    
 */
describe('Login page', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should have git proxy logo', () => {
    cy.get('[data-test="git-proxy-logo"]').should('exist');
  });

  it('should have username input', () => {
    cy.get('[data-test="username"]').should('exist');
  });

  it('should have passsword input', () => {
    cy.get('[data-test="password"]').should('exist');
  });

  it('should have login button', () => {
    cy.get('[data-test="login"]').should('exist');
  });

  describe('OIDC login button', () => {
    it('should exist', () => {
      cy.get('[data-test="oidc-login"]').should('exist');
    });

    // Validates that OIDC is configured correctly
    it('should redirect to /oidc', () => {
      cy.get('[data-test="oidc-login"]').click();
      cy.url().should('include', '/oidc');
    });
  });
});
