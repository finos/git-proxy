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
