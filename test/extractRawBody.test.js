const { expect } = require('chai');
const sinon = require('sinon');
const { PassThrough } = require('stream');
const proxyquire = require('proxyquire').noCallThru();

const fakeRawBody = sinon.stub().resolves(Buffer.from('payload'));

const fakeChain = {
  executeChain: sinon.stub(),
};

const { extractRawBody, isPackPost } = proxyquire('../src/proxy/routes', {
  'raw-body': fakeRawBody,
  '../chain': fakeChain,
});

describe('extractRawBody middleware', () => {
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
    await extractRawBody(req, res, next);
    expect(next.calledOnce).to.be.true;
    expect(fakeRawBody.called).to.be.false;
  });

  it('extracts raw body and sets bodyRaw property', async () => {
    req.write('abcd');
    req.end();

    await extractRawBody(req, res, next);

    expect(fakeRawBody.calledOnce).to.be.true;
    expect(fakeChain.executeChain.called).to.be.false; // extractRawBody no longer calls executeChain
    expect(next.calledOnce).to.be.true;
    expect(req.bodyRaw).to.exist;
    expect(typeof req.pipe).to.equal('function');
  });
});

describe('isPackPost()', () => {
  it('returns true for git-upload-pack POST', () => {
    expect(isPackPost({ method: 'POST', url: '/a/b.git/git-upload-pack' })).to.be.true;
  });
  it('returns true for git-upload-pack POST, with a gitlab style multi-level org', () => {
    expect(isPackPost({ method: 'POST', url: '/a/bee/sea/dee.git/git-upload-pack' })).to.be.true;
  });
  it('returns true for git-upload-pack POST, with a bare (no org) repo URL', () => {
    expect(isPackPost({ method: 'POST', url: '/a.git/git-upload-pack' })).to.be.true;
  });
  it('returns false for other URLs', () => {
    expect(isPackPost({ method: 'POST', url: '/info/refs' })).to.be.false;
  });
});
