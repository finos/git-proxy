// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

// start of a login command with sessions
// TODO: resolve issues with the CSRF token
Cypress.Commands.add('login', (username, password) => {
  cy.session([username, password], () => {
    cy.visit('/login');
    cy.intercept('GET', '**/api/auth/profile').as('getUser');

    cy.get('[data-test=username]').type(username);
    cy.get('[data-test=password]').type(password);
    cy.get('[data-test=login]').click();

    cy.wait('@getUser');
    cy.url().should('include', '/dashboard/repo');
  });
});

Cypress.Commands.add('logout', () => {
  Cypress.session.clearAllSavedSessions();
});

Cypress.Commands.add('getCSRFToken', () => {
  return cy.request('GET', 'http://localhost:8080/api/v1/repo').then((res) => {
    let cookies = res.headers['set-cookie'];

    if (typeof cookies === 'string') {
      cookies = [cookies];
    }

    if (!cookies) {
      throw new Error('No cookies found in response');
    }

    const csrfCookie = cookies.find((c) => c.startsWith('csrf='));
    if (!csrfCookie) {
      throw new Error('No CSRF cookie found in response headers');
    }

    const token = csrfCookie.split('=')[1].split(';')[0];
    return cy.wrap(decodeURIComponent(token));
  });
});
