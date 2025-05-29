import moment from 'moment';

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
          timestamp: '2023-10-01T12:00:00Z',
          autoApproved: true,
        },
      },
    }).as('getPush');
  });

  it('should display auto-approved message and verify tooltip contains the expected timestamp', () => {
    cy.visit('/dashboard/push/123');

    cy.wait('@getPush');

    cy.contains('Auto-approved by system').should('be.visible');

    cy.get('svg.MuiSvgIcon-root')
      .filter((_, el) => getComputedStyle(el).fill === 'rgb(0, 128, 0)')
      .invoke('attr', 'style')
      .should('include', 'cursor: default')
      .and('include', 'opacity: 0.5');

    const expectedTooltipTimestamp = moment('2023-10-01T12:00:00Z')
      .local()
      .format('dddd, MMMM Do YYYY, h:mm:ss a');

    cy.get('kbd')
      .trigger('mouseover')
      .then(() => {
        cy.get('.MuiTooltip-tooltip').should('contain', expectedTooltipTimestamp);
      });

    cy.contains('approved this contribution').should('not.exist');
  });
});
