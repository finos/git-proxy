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

describe('Push Requests - Tab Filtering', () => {
  const testUser = {
    username: 'testuser',
    password: 'user123',
    email: 'testuser@example.com',
    // Upstream access token, minted in before(); pushes present this, not the password.
    upstreamToken: '',
  };

  const approverUser = {
    username: 'approver',
    password: 'approver123',
    email: 'approver@example.com',
  };

  // Every push made here carries this marker in its commit message, so searching for it scopes the
  // list to this spec's pushes regardless of what other specs left behind.
  const marker = `pushreq-${Date.now()}`;
  const pushIds = { pending: '', approved: '', rejected: '', canceled: '' };
  const erroredPushId = `${marker}-errored`;
  const statuses = Object.keys(pushIds);

  const getApiBaseUrl = () => Cypress.env('API_BASE_URL') || Cypress.config('baseUrl');
  const pushRow = (id) => `tr[aria-label="Open activity ${id}"]`;

  function createPush(status) {
    return cy.createPush(
      testUser.username,
      testUser.upstreamToken,
      testUser.email,
      `${marker}-${status}`,
    );
  }

  function postPushAction(pushId, action, body = {}) {
    cy.getCSRFToken().then((csrfToken) => {
      cy.request({
        method: 'POST',
        url: `${getApiBaseUrl()}/api/v1/push/${pushId}/${action}`,
        body,
        headers: { 'X-CSRF-TOKEN': csrfToken },
      });
    });
  }

  /** Adds an errored copy of this spec's pending push to the list response. */
  function stubErroredPush() {
    cy.intercept({ method: 'GET', pathname: '/api/v1/push' }, (req) => {
      req.continue((res) => {
        const pending = Array.isArray(res.body) && res.body.find((p) => p.id === pushIds.pending);
        if (pending) {
          res.body.push({
            ...pending,
            id: erroredPushId,
            _id: erroredPushId,
            error: true,
            errorMessage: 'Simulated failure',
          });
        }
      });
    }).as('getPushes');
  }

  function visitActivity(query) {
    stubErroredPush();
    cy.visit(`/dashboard/push?filter=${marker}${query ? `&${query}` : ''}`);
    cy.wait('@getPushes');
    cy.get('[data-testid="pushes-table"]').should('be.visible');
  }

  before(() => {
    cy.login('admin', 'admin');

    cy.createUser(testUser.username, testUser.password, testUser.email, {
      'git-server': testUser.username,
    });
    cy.createUser(approverUser.username, approverUser.password, approverUser.email);

    cy.getTestRepoId().then((repoId) => {
      cy.addUserPushPermission(repoId, testUser.username);
      cy.addUserAuthorisePermission(repoId, approverUser.username);
    });

    cy.mintUpstreamToken(testUser.username, testUser.password).then((token) => {
      testUser.upstreamToken = token;
    });

    cy.logout();

    // Deferred so the pushes pick up the token minted above.
    cy.then(() => {
      statuses.forEach((status) => {
        createPush(status).then((id) => {
          pushIds[status] = id;
        });
      });
    });

    // Approval goes through the attestation dialog, the other outcomes through the API.
    cy.login(approverUser.username, approverUser.password);
    cy.then(() => {
      cy.visit(`/dashboard/push/${pushIds.approved}`);
    });
    cy.get('[data-testid="attestation-open-btn"]').click();
    cy.get('[data-testid="attestation-dialog"]')
      .find('input[type="checkbox"]')
      .each(($checkbox) => {
        cy.wrap($checkbox).check({ force: true });
      });
    cy.get('[data-testid="attestation-confirm-btn"]').click();
    cy.then(() => {
      cy.url().should('not.include', pushIds.approved);
      postPushAction(pushIds.rejected, 'reject', { reason: 'Test rejection' });
    });
    cy.logout();

    cy.login(testUser.username, testUser.password);
    cy.then(() => {
      postPushAction(pushIds.canceled, 'cancel');
    });
    cy.logout();
  });

  after(() => {
    cy.login('admin', 'admin');
    statuses.forEach((status) => {
      cy.deleteTestPush(pushIds[status]);
    });
    cy.deleteTestUser(testUser.username);
    cy.deleteTestUser(approverUser.username);
    cy.logout();
  });

  beforeEach(() => {
    cy.login('admin', 'admin');
  });

  afterEach(() => {
    cy.logout();
  });

  it('All 6 tabs render (All, Pending, Approved, Canceled, Rejected, Error)', () => {
    visitActivity('tab=all');

    cy.get('[aria-label="Filter activity by status"]').within(() => {
      ['All', 'Pending', 'Approved', 'Canceled', 'Rejected', 'Error'].forEach((label) => {
        cy.contains('a', label).should('be.visible');
      });
    });
  });

  it('All tab lists every push', () => {
    visitActivity('tab=all');

    statuses.forEach((status) => {
      cy.get(pushRow(pushIds[status])).should('be.visible');
    });
    cy.get(pushRow(erroredPushId)).should('be.visible');
  });

  statuses.forEach((status) => {
    const label = status.charAt(0).toUpperCase() + status.slice(1);

    it(`${label} tab filters to show only ${status} pushes`, () => {
      visitActivity(status === 'pending' ? '' : 'tab=all');

      cy.get('[aria-label="Filter activity by status"]').contains('a', label).click();

      if (status === 'pending') {
        cy.url().should('not.include', 'tab=');
      } else {
        cy.url().should('include', `tab=${status}`);
      }
      cy.get(pushRow(pushIds[status])).should('be.visible');
      statuses
        .filter((other) => other !== status)
        .forEach((other) => {
          cy.get(pushRow(pushIds[other])).should('not.exist');
        });
      cy.get(pushRow(erroredPushId)).should('not.exist');
    });
  });

  it('Error tab filters to show only errored pushes', () => {
    visitActivity();

    cy.get('[aria-label="Filter activity by status"]').contains('a', 'Error').click();

    cy.url().should('include', 'tab=error');
    cy.get(pushRow(erroredPushId)).should('be.visible');
    statuses.forEach((status) => {
      cy.get(pushRow(pushIds[status])).should('not.exist');
    });
  });

  it('Push table rows are clickable and navigate to Push Details', () => {
    visitActivity();

    cy.get(pushRow(pushIds.pending)).click();

    cy.url().should('include', `/dashboard/push/${pushIds.pending}`);
    cy.get('[data-testid="push-status"]').should('contain', 'Pending');
  });
});
