describe('Repo', () => {
  let repoName;
  let cloneURL;
  let csrfToken;
  let cookies;
  let repoId;

  before(() => {
    cy.login('admin', 'admin');

    // Create a new repo
    cy.getCSRFToken().then((csrfToken) => {
      repoName = `${Date.now()}`;
      cloneURL = `http://localhost:8000/github.com/cypress-test/${repoName}.git`;

      cy.request({
        method: 'POST',
        url: 'http://localhost:8080/api/v1/repo',
        body: {
          project: 'cypress-test',
          name: repoName,
          url: `https://github.com/cypress-test/${repoName}.git`
        },
        headers: { 
          cookie: cookies?.join('; ') || '',
          'X-CSRF-TOKEN': csrfToken
        }
      }).then((res) => {
        expect(res.status).to.eq(200);
        repoId = res.body._id;
      });
    });
  });

  it('Opens tooltip with correct content and can copy', () => {
    cy.visit('/dashboard/repo');
    cy.on('uncaught:exception', () => false);

    const tooltipQuery = 'div[role="tooltip"]';

    // Check the tooltip isn't open to start with
    cy.get(tooltipQuery)
      .should('not.exist');

    // Find the repo's Code button and click it
      cy.get(`a[href="/dashboard/repo/${repoId}"]`)
      .closest('tr')
      .find('span')
      .contains('Code')
      .should('exist')
      .click();

    // Check tooltip is open and contains the correct clone URL
    cy.get(tooltipQuery)
      .should('exist')
      .find('span')
      .contains(cloneURL)
      .should('exist')
      .parent()
      .find('span')
      .next()
      .get('svg.octicon-copy')
      .should('exist')
      .click()
      .get('svg.octicon-copy')
      .should('not.exist')
      .get('svg.octicon-check')
      .should('exist');
  });

  after(() => {
    // Delete the repo
    cy.getCSRFToken().then((csrfToken) => {
      cy.request({
        method: 'DELETE',
        url: `http://localhost:8080/api/v1/repo/${repoName}/delete`,
        headers: {
          cookie: cookies?.join('; ') || '',
            'X-CSRF-TOKEN': csrfToken
        }
      });
    });
  });
});
