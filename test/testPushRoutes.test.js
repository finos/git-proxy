// Import the dependencies for testing
const chai = require('chai');
const chaiHttp = require('chai-http');
const db = require('../src/db');
const service = require('../src/service');
const sinon = require('sinon');

chai.use(chaiHttp);
chai.should();
const expect = chai.expect;

describe('Push Routes Test with Admin Login', async () => {
  let app;
  let cookie;
  const commitId =
    '0000000000000000000000000000000000000000__79b4d8953cbc324bcc1eb53d6412ff89666c241f';
  const mockPush = { id: commitId, message: 'Test Push', user: 'testUser' };
  const commitId2 =
    '0000000000000000000000000000000000000000__63b4d8953cbc324bcc1eb53d6412ff89666c241f'; // eslint-disable-line max-len
  const mockPush2 = { id: commitId, message: 'Test Push', user: 'testUser2' };

  before(async function () {
    app = await service.start();

    const res = await chai.request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'admin',
    });

    expect(res).to.have.cookie('connect.sid');
    res.should.have.status(200);

    // Get the connect cooie
    res.headers['set-cookie'].forEach((x) => {
      if (x.startsWith('connect')) {
        cookie = x.split(';')[0];
      }
    });
  });

  describe('test GET API', async function () {
    it('should return pushes for /', async function () {

      const response = await chai
        .request(app)
        .get('/api/v1/push')
        .set('Cookie', `${cookie}`);
      response.should.have.status(200);

    })
  })

  describe('test GET API with query params', async function () {
    it('should ignore "limit" and "skip" query params', async () => {
      const getPushStub = sinon.stub(db, 'getPush').resolves();

      const res = await chai.request(app)
        .get('/api/v1/push/')
        .query({ limit: 5, skip: 10, admin: false });

      expect(res).to.have.status(200);
      expect(getPushStub.calledWith({}));
    });
  });

  describe('test push API', async function () {
    it('should get 404 for unknown push', async function () {
      const res = await chai
        .request(app)
        .get(`/api/v1/push/${commitId}`)
        .set('Cookie', `${cookie}`);
      res.should.have.status(404);
    });
  });

  describe('test push API', async function () {
    it('should get push object if found', async function () {
      sinon.stub(db, 'getPush').resolves(mockPush);

      const res = await chai
        .request(app)
        .get(`/api/v1/push/${commitId}`)
        .set('Cookie', `${cookie}`);
      res.should.have.status(200);
    });
  });

  describe('test reject POST API with req user set', async function () {
    it('should respond with status 401 for invalid git account', async function () {

      sinon.stub(db, 'getPush').resolves(mockPush);

      const mockUsers = [];
      sinon.stub(db, 'getUsers').resolves(mockUsers);
      const response = await chai
        .request(app)
        .post(`/api/v1/push/${commitId}/reject`)
        .set('Cookie', `${cookie}`);
      response.should.have.status(401);

      expect(response.body).to.have.property('message', 'The git account testUser could not be found');

    })
  })

  describe('test reject POST API', async function () {
    it('should respond with status 200 for rejecting push', async function () {
      sinon.stub(db, 'getPush').resolves(mockPush);

      const mockUsers = [{ username: 'testUser' }];
      sinon.stub(db, 'getUsers').resolves(mockUsers);

      sinon.stub(db, 'canUserApproveRejectPush').resolves(true);

      const mockRejectRespone = { message: `reject ${commitId}` };
      sinon.stub(db, 'reject').resolves(mockRejectRespone);

      const response = await chai
        .request(app)
        .post(`/api/v1/push/${commitId}/reject`)
        .set('Cookie', `${cookie}`);

      response.should.have.status(200);
    })
  })

  describe('test reject POST API without login', async function () {
    it('should respond with status 401 for unauthorized reject', async function () {

      const response = await chai
        .request(app)
        .post(`/api/v1/push/${commitId}/reject`);

      // console.log(response);
      response.should.have.status(401);
      expect(response.body).to.have.property('message', 'not logged in');

    })
  })

  describe('test authorize POST API without attestation', async function () {
    it('should return status 401 for unauthorized approver', async function () {
      sinon.stub(db, 'getPush').resolves(mockPush);

      const mockUsers = [];
      sinon.stub(db, 'getUsers').resolves(mockUsers);
      const response = await chai
        .request(app)
        .post(`/api/v1/push/${commitId}/authorise`)
        .send({
          params: {
            attestation: [
              {
                label: 'Authorising via GitProxy',
                checked: false,
              },
            ],
          }
        })
        .set('Cookie', `${cookie}`);
      response.should.have.status(401);

      expect(response.body).to.have.property('message', 'You are unauthorized to perform this action...');

    })
  })

  describe('test authorize POST API', async function () {
    it('should return status 401 for invalid account', async function () {
      sinon.stub(db, 'getPush').resolves(mockPush);

      const mockUsers = [];
      sinon.stub(db, 'getUsers').resolves(mockUsers);
      const response = await chai
        .request(app)
        .post(`/api/v1/push/${commitId}/authorise`)
        .send({
          params: {
            attestation: [
              {
                label: 'Authorising via GitProxy',
                checked: true,
              },
            ],
          }
        })
        .set('Cookie', `${cookie}`);
      response.should.have.status(401);

      expect(response.body).to.have.property('message', 'The git account testUser could not be found');

    })
  })

  describe('test authorize POST API for approval without github account', async function () {
    it('should return status 401 for authorising push without assosciating github account', async function () {

      sinon.stub(db, 'getPush').resolves(mockPush2);

      const mockUsers = [{ username: 'testUser2' }];
      sinon.stub(db, 'getUsers')
        .onFirstCall().resolves(mockUsers)
        .onSecondCall().resolves([{ username: 'admin' }]);
      sinon.stub(db, 'canUserApproveRejectPush').resolves(true);


      const response = await chai
        .request(app)
        .post(`/api/v1/push/${commitId2}/authorise`)
        .send({
          params: {
            attestation: [
              {
                label: 'Authorising via GitProxy',
                checked: true,
              },
            ],
          }
        })
        .set('Cookie', `${cookie}`);
      response.should.have.status(401);

      expect(response.body).to.have.property('message', 'You must associate a GitHub account with your user before approving...');

    })
  })

  describe('test authorize POST API for approval ', async function () {
    it('should return status 200 for authorising push', async function () {

      sinon.stub(db, 'getPush').resolves(mockPush2);

      const mockUsers = [{ username: 'testUser2' }];
      sinon.stub(db, 'getUsers')
        .onFirstCall().resolves(mockUsers)
        .onSecondCall().resolves([{ username: 'admin', gitAccount: 'adminAccount' }]);
      sinon.stub(db, 'canUserApproveRejectPush').resolves(true);
      sinon.stub(db, 'authorise').resolves(`authorised ${commitId}`);


      const response = await chai
        .request(app)
        .post(`/api/v1/push/${commitId2}/authorise`)
        .send({
          params: {
            attestation: [
              {
                label: 'Authorising via GitProxy',
                checked: true,
              },
            ],
          }
        })
        .set('Cookie', `${cookie}`);
      response.should.have.status(200);

    })
  })

  describe('test cancel request POST API', async function () {
    // eslint-disable-next-line no-invalid-this
    this.timeout(5000);
    it('should return status 200 when admin cancel push ', async function () {
      sinon.stub(db, 'canUserCancelPush').resolves(true);
      sinon.stub(db, 'cancel').resolves(`canceled ${commitId}`);

      const response = await chai
        .request(app)
        .post(`/api/v1/push/${commitId}/cancel`)
        .set('Cookie', `${cookie}`);

      response.should.have.status(200);
    })

  })

  after(async function () {
    const res = await chai.request(app).post('/api/auth/logout').set('Cookie', `${cookie}`);
    res.should.have.status(200);

    cookie = null;
    await service.httpServer.close();
  });

  afterEach(() => {
    sinon.restore();
  })
});

describe('Push Routes Test with TestUser Login', async () => {

  let testUserApp;
  let cookie;

  const commitId =
    '0000000000000000000000000000000000000000__79b4d8953cbc324bcc1eb53d6412ff89666c241f'; // eslint-disable-line max-len
  const mockPush = { id: commitId, message: 'Test Push', user: 'testUser' };

  const commitId2 =
    '0000000000000000000000000000000000000000__63b4d8953cbc324bcc1eb53d6412ff89666c241f'; // eslint-disable-line max-len
  const mockPush2 = { id: commitId, message: 'Test Push', user: 'testUser2' };

  before(async function () {

    const testUserPassword = 'password123';
    const testUser = 'testUser';
    const testEmail = 'test@test.com';
    const testGitAccount = 'testUserAccount';

    await db.deleteUser(testUser);
    await db.createUser(testUser, testUserPassword, testEmail, testGitAccount);

    testUserApp = await service.start();
    const res = await chai.request(testUserApp).post('/api/auth/login').send({
      username: 'testUser',
      password: 'password123',
    });

    expect(res).to.have.cookie('connect.sid');
    res.should.have.status(200);

    res.headers['set-cookie'].forEach((x) => {
      if (x.startsWith('connect')) {
        cookie = x.split(';')[0];
      }
    });



  });

  describe('test reject POST API for own change', async function () {
    it('should respond with status 401 for rejecting own push', async function () {
      sinon.stub(db, 'getPush').resolves(mockPush);

      const mockUsers = [{ username: 'testUser' }];
      sinon.stub(db, 'getUsers').resolves(mockUsers);
      const response = await chai
        .request(testUserApp)
        .post(`/api/v1/push/${commitId}/reject`)
        .set('Cookie', `${cookie}`);

      response.should.have.status(401);
      expect(response.body).to.have.property('message', 'Cannot reject your own changes');


    })
  })

  describe('test reject POST API for unauthorised reject user', async function () {
    it('should respond with status 401 for trying to reject without authorisation', async function () {


      sinon.stub(db, 'getPush').resolves(mockPush2);

      const mockUsers = [{ username: 'testUser2' }];
      sinon.stub(db, 'getUsers').resolves(mockUsers);

      const mockIsAllowed = false;
      sinon.stub(db, 'canUserApproveRejectPush').resolves(mockIsAllowed);

      const response = await chai
        .request(testUserApp)
        .post(`/api/v1/push/${commitId2}/reject`)
        .set('Cookie', `${cookie}`);

      response.should.have.status(401);
      expect(response.body).to.have.property('message', 'User is not authorised to reject changes');


    })
  })

  describe('test authorize POST API for own change', async function () {
    it('should return status 401 for approving own changes', async function () {
      sinon.stub(db, 'getPush').resolves(mockPush);

      const mockUsers = [{ username: 'testUser' }];
      sinon.stub(db, 'getUsers').resolves(mockUsers);
      const response = await chai
        .request(testUserApp)
        .post(`/api/v1/push/${commitId}/authorise`)
        .send({
          params: {
            attestation: [
              {
                label: 'Authorising via GitProxy',
                checked: true,
              },
            ],
          }
        })
        .set('Cookie', `${cookie}`);
      response.should.have.status(401);

      expect(response.body).to.have.property('message', 'Cannot approve your own changes');

    })
  })

  describe('test authorize POST API for unauthorized approval on project', async function () {
    it('should return status 401 for authorising push without access to approve', async function () {
      sinon.stub(db, 'getPush').resolves(mockPush2);

      const mockUsers = [{ username: 'testUser2' }];
      sinon.stub(db, 'getUsers').resolves(mockUsers);
      sinon.stub(db, 'canUserApproveRejectPush').resolves(false);

      const response = await chai
        .request(testUserApp)
        .post(`/api/v1/push/${commitId2}/authorise`)
        .send({
          params: {
            attestation: [
              {
                label: 'Authorising via GitProxy',
                checked: true,
              },
            ],
          }
        })
        .set('Cookie', `${cookie}`);
      response.should.have.status(401);

      expect(response.body).to.have.property('message', 'user testUser not authorised to approve push\'s on this project');

    })
  })

  describe('test cancel request POST API', async function () {
    // eslint-disable-next-line no-invalid-this
    this.timeout(5000);
    it('should return status 401 when user is not logged in to cancel push ', async function () {

      const response = await chai
        .request(testUserApp)
        .post(`/api/v1/push/${commitId}/cancel`);

      response.should.have.status(401);
      expect(response.body).to.have.property('message', 'not logged in');

    })

  })

  describe('test cancel request POST API', async function () {
    // eslint-disable-next-line no-invalid-this
    this.timeout(5000);
    it('should return status 401 when user is not authorized to cancel push ', async function () {
      sinon.stub(db, 'canUserCancelPush').resolves(false);

      const response = await chai
        .request(testUserApp)
        .post(`/api/v1/push/${commitId}/cancel`)
        .set('Cookie', `${cookie}`);

      response.should.have.status(401);
      expect(response.body).to.have.property('message', 'User testUser not authorised to cancel push requests on this project.');

    })

  });

  after(async function () {
    await chai.request(testUserApp).post('/api/auth/logout').set('Cookie', `${cookie}`);

    cookie = null;
    await service.httpServer.close();

    sinon.restore();
  })

  afterEach(async function () {
    sinon.restore();
  })

});