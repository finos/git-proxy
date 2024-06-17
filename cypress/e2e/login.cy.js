describe("Display finos UI",()=>{
  
  beforeEach(() =>{
    cy.visit('/login')
 })
 it('shoud find git proxy logo',() =>{
  cy.get('[data-test="git-proxy-logo"]').should('exist')
})
  it('shoud find username',() =>{
    cy.get('[data-test="username"]').should('exist')
  })

  it('shoud find passsword',() =>{
    cy.get('[data-test="password"]').should('exist')
  })
  it('shoud find login button',() =>{
    cy.get('[data-test="login"]').should('exist')
  })
})