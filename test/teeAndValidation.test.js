const { expect } = require('chai');
const sinon = require('sinon');
const { PassThrough } = require('stream');
const proxyquire = require('proxyquire').noCallThru();

const fakeRawBody = sinon.stub().resolves(Buffer.from('payload'));

const fakeChain = {
  executeChain: sinon.stub(),
};

const { teeAndValidate, isPackPost, handleMessage } = proxyquire('../src/proxy/routes', {
  'raw-body': fakeRawBody,
  '../chain': fakeChain,
});

describe('teeAndValidate middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = new PassThrough();
    req.method = 'POST';
    req.url = '/proj/foo.git/git-upload-pack';

    res = {
      set: sinon.stub().returnsThis(),
      status: sinon.stub().returnsThis(),
      send: sinon.stub(),
      end: sinon.stub(),
    };
    next = sinon.spy();

    fakeRawBody.resetHistory();
    fakeChain.executeChain.resetHistory();
  });

  it('skips non-pack posts', async () => {
    req.method = 'GET';
    await teeAndValidate(req, res, next);
    expect(next.calledOnce).to.be.true;
    expect(fakeRawBody.called).to.be.false;
  });

  it('when the chain blocks it sends a packet and does NOT call next()', async () => {
    fakeChain.executeChain.resolves({ blocked: true, blockedMessage: 'denied!' });

    req.write('abcd');
    req.end();

    await teeAndValidate(req, res, next);

    expect(fakeRawBody.calledOnce).to.be.true;
    expect(fakeChain.executeChain.calledOnce).to.be.true;
    expect(next.called).to.be.false;

    expect(res.set.called).to.be.true;
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledWith(handleMessage('denied!'))).to.be.true;
  });

  it('when the chain allow it calls next() and overrides req.pipe', async () => {
    fakeChain.executeChain.resolves({ blocked: false, error: false });

    req.write('abcd');
    req.end();

    await teeAndValidate(req, res, next);

    expect(fakeRawBody.calledOnce).to.be.true;
    expect(fakeChain.executeChain.calledOnce).to.be.true;
    expect(next.calledOnce).to.be.true;
    expect(typeof req.pipe).to.equal('function');
  });
});

describe('isPackPost()', () => {
  it('returns true for git-upload-pack POST', () => {
    expect(isPackPost({ method: 'POST', url: '/a/b.git/git-upload-pack' })).to.be.true;
  });
  it('returns false for other URLs', () => {
    expect(isPackPost({ method: 'POST', url: '/info/refs' })).to.be.false;
  });
});
