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

  it('should redirect to repo list on valid login', () => {
    cy.intercept('GET', '**/api/auth/me').as('getUser');

    cy.get('[data-test="username"]').type('admin');
    cy.get('[data-test="password"]').type('admin');
    cy.get('[data-test="login"]').click();

    cy.wait('@getUser');

    cy.url().should('include', '/dashboard/repo');
  })

  describe('OIDC login button', () => {
    it('should exist', () => {
      cy.get('[data-test="oidc-login"]').should('exist');
    });

    // Validates that OIDC is configured correctly
    it('should redirect to /oidc', () => {
      // Set intercept first, since redirect on click can be quick
      cy.intercept('GET', '/api/auth/oidc').as('oidcRedirect');
      cy.get('[data-test="oidc-login"]').click();
      cy.wait('@oidcRedirect');
    });
  });
});
