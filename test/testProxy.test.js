const chai = require('chai');
const sinon = require('sinon');
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');

const proxyModule = require('../src/proxy/index');
const expect = chai.expect;

describe('Proxy Module', () => {
  let sandbox;
  
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createApp', () => {
    it('should create express app with router', async () => {
      const app = await proxyModule.default.createApp();

      // Basic checks for express app
      expect(app).to.be.an('function');
      expect(app.use).to.be.a('function');
      expect(app.listen).to.be.a('function');
      
      expect(app.settings).to.be.an('object');
    });
  });

  describe('start', () => {
    let httpCreateServerStub;
    let httpsCreateServerStub;
    let mockHttpServer;
    let mockHttpsServer;
    let getTLSEnabledStub;
    let proxyPreparationsStub;
    let createAppStub;

    beforeEach(() => {
      mockHttpServer = {
        listen: sandbox.stub().callsArg(1)
      };
      
      mockHttpsServer = {
        listen: sandbox.stub().callsArg(1)
      };

      httpCreateServerStub = sandbox.stub(http, 'createServer').returns(mockHttpServer);
      httpsCreateServerStub = sandbox.stub(https, 'createServer').returns(mockHttpsServer);
      
      getTLSEnabledStub = sandbox.stub(require('../src/config'), 'getTLSEnabled');
      
      proxyPreparationsStub = sandbox.stub(proxyModule, 'proxyPreparations').resolves();
      createAppStub = sandbox.stub(proxyModule.default, 'createApp').resolves({ express: 'app' });
    });

    it('should start HTTP server only when TLS is disabled', async () => {
      getTLSEnabledStub.returns(false);

      const app = await proxyModule.default.start();

      expect(httpCreateServerStub.calledOnce).to.be.true;
      expect(httpsCreateServerStub.called).to.be.false;
      expect(mockHttpServer.listen.calledOnce).to.be.true;
      expect(proxyPreparationsStub.calledOnce).to.be.true;
    });
  });
});
