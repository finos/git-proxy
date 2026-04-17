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

describe('Auto-Approved Push Test', () => {
  beforeEach(() => {
    cy.login('admin', 'admin');

    cy.intercept('GET', '/api/v1/push/123', {
      statusCode: 200,
      body: {
        steps: [
          {
            stepName: 'diff',
            content: '',
          },
        ],
        error: false,
        allowPush: true,
        authorised: true,
        canceled: false,
        rejected: false,
        autoApproved: true,
        autoRejected: false,
        commitFrom: 'commitFrom',
        commitTo: 'commitTo',
        branch: 'refs/heads/main',
        user: 'testUser',
        id: 'commitFrom__commitTo',
        type: 'push',
        method: 'POST',
        timestamp: 1696161600000,
        project: 'testUser',
        repoName: 'test.git',
        url: 'https://github.com/testUser/test.git',
        repo: 'testUser/test.git',
        commitData: [
          {
            tree: '1234',
            parent: '12345',
          },
        ],
        attestation: {
          timestamp: 1696161600000,
          reviewer: {
            username: 'system',
            displayName: '',
          },
        },
      },
    }).as('getPush');
  });

  it('should display auto-approved message', () => {
    cy.visit('/dashboard/push/123');

    cy.wait('@getPush');

    cy.contains('Auto-approved by system').should('be.visible');

    cy.contains('approved this contribution').should('not.exist');
  });
});
