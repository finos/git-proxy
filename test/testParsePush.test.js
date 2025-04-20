const { expect } = require('chai');
const sinon = require('sinon');
const zlib = require('zlib');

const {
  exec,
  getCommitData,
  getPackMeta,
  unpack
} = require('../src/proxy/processors/push-action/parsePush');

function createSamplePackBuffer(numEntries = 1, commitContent = 'tree 123\nparent 456\nauthor A <a@a> 123 +0000\ncommitter C <c@c> 456 +0000\n\nmessage', type = 1) {
  const header = Buffer.alloc(12);
  header.write('PACK', 0, 4, 'utf-8'); // Signature
  header.writeUInt32BE(2, 4); // Version
  header.writeUInt32BE(numEntries, 8); // Number of entries

  const originalContent = Buffer.from(commitContent, 'utf8');
  // Actual zlib used for setup
  const compressedContent = zlib.deflateSync(originalContent);

  // Basic type/size encoding (assumes small sizes for simplicity)
  // Real PACK files use variable-length encoding for size
  let typeAndSize = (type << 4) | (compressedContent.length & 0x0f); // Lower 4 bits of size
  if (compressedContent.length >= 16) {
    typeAndSize |= 0x80;
  }
  const objectHeader = Buffer.from([typeAndSize]); // Placeholder, actual size encoding is complex

  // Combine parts
  const packContent = Buffer.concat([objectHeader, compressedContent]);

  // Append checksum (dummy 20 bytes)
  const checksum = Buffer.alloc(20);

  return Buffer.concat([header, packContent, checksum]);
}

function createPacketLineBuffer(lines) {
  let buffer = Buffer.alloc(0);
  lines.forEach(line => {
    const lengthInHex = (line.length + 4).toString(16).padStart(4, '0');
    buffer = Buffer.concat([buffer, Buffer.from(lengthInHex, 'ascii'), Buffer.from(line, 'ascii')]);
  });
  buffer = Buffer.concat([buffer, Buffer.from('0000', 'ascii')]);

  return buffer;
}

describe('parsePackFile', () => {
  let action;
  let req;
  let sandbox;
  let zlibInflateStub; // No deflate stub used due to complexity of PACK encoding

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock Action and Step and spy on methods
    action = {
      branch: null,
      commitFrom: null,
      commitTo: null,
      commitData: [],
      user: null,
      steps: [],
      addStep: sandbox.spy(function (step) {
        this.steps.push(step); // eslint-disable-line no-invalid-this
      }),
      setCommit: sandbox.spy(function (from, to) {
        this.commitFrom = from; // eslint-disable-line no-invalid-this
        this.commitTo = to; // eslint-disable-line no-invalid-this
      }),
    };

    req = {
      body: null,
    };

    zlibInflateStub = sandbox.stub(zlib, 'inflateSync');
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('exec', () => {
    it('should add error step if req.body is missing', async () => {
      req.body = undefined;
      const result = await exec(req, action);

      expect(result).to.equal(action);
      const step = action.steps[0];
      expect(step.stepName).to.equal('parsePackFile');
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('No data received');
    });

    it('should add error step if req.body is empty', async () => {
      req.body = Buffer.alloc(0);
      const result = await exec(req, action);

      expect(result).to.equal(action);
      const step = action.steps[0];
      expect(step.stepName).to.equal('parsePackFile');
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('No data received');
    });

    it('should add error step if no ref updates found', async () => {
      const packetLines = ['some other line\n', 'another line\n'];
      req.body = createPacketLineBuffer(packetLines); // We don't include PACK data (only testing ref updates)
      const result = await exec(req, action);

      expect(result).to.equal(action);
      const step = action.steps[0];
      expect(step.stepName).to.equal('parsePackFile');
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('pushing to a single branch');
      expect(step.logs[0]).to.include('Invalid number of branch updates');
    });

    it('should add error step if multiple ref updates found', async () => {
      const packetLines = [
        'oldhash1 newhash1 refs/heads/main\0caps\n',
        'oldhash2 newhash2 refs/heads/develop\0caps\n',
      ];
      req.body = createPacketLineBuffer(packetLines);
      const result = await exec(req, action);

      expect(result).to.equal(action);
      const step = action.steps[0];
      expect(step.stepName).to.equal('parsePackFile');
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('pushing to a single branch');
      expect(step.logs[0]).to.include('Invalid number of branch updates');
      expect(step.logs[1]).to.include('Expected 1, but got 2');
    });

    it('should add error step if PACK data is missing', async () => {
      const oldCommit = 'a'.repeat(40);
      const newCommit = 'b'.repeat(40);
      const ref = 'refs/heads/feature/test';
      const packetLines = [`${oldCommit} ${newCommit} ${ref}\0capa\n`];

      req.body = createPacketLineBuffer(packetLines);

      const result = await exec(req, action);

      expect(result).to.equal(action);
      const step = action.steps[0];
      expect(step.stepName).to.equal('parsePackFile');
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('Unable to parse push');

      expect(action.branch).to.equal(ref);
      expect(action.setCommit.calledOnceWith(oldCommit, newCommit)).to.be.true;
    });

    it('should successfully parse a valid push request', async () => {
      const oldCommit = 'a'.repeat(40);
      const newCommit = 'b'.repeat(40);
      const ref = 'refs/heads/main';
      const packetLine = `${oldCommit} ${newCommit} ${ref}\0capabilities\n`;

      const commitContent = `tree 1234567890abcdef1234567890abcdef12345678
        parent abcdef1234567890abcdef1234567890abcdef12
        author Test Author <test@example.com> 1678886400 +0000
        committer Test Committer <committer@example.com> 1678886460 +0100

        feat: Add new feature

        This is the commit body.`;
      const commitContentBuffer = Buffer.from(commitContent, 'utf8');

      zlibInflateStub.returns(commitContentBuffer);

      const numEntries = 1;
      const packBuffer = createSamplePackBuffer(numEntries, commitContent, 1); // Use real zlib
      req.body = Buffer.concat([createPacketLineBuffer([packetLine]), packBuffer]);

      const result = await exec(req, action);
      expect(result).to.equal(action);

      // Check step and action properties
      const step = action.steps.find(s => s.stepName === 'parsePackFile');
      expect(step).to.exist;
      expect(step.error).to.be.false;
      expect(step.errorMessage).to.be.null;

      expect(action.branch).to.equal(ref);
      expect(action.setCommit.calledOnceWith(oldCommit, newCommit)).to.be.true;
      expect(action.commitFrom).to.equal(oldCommit);
      expect(action.commitTo).to.equal(newCommit);
      expect(action.user).to.equal('Test Committer');

      // Check parsed commit data
      const commitMessages = action.commitData.map(commit => commit.message);
      expect(action.commitData).to.be.an('array').with.lengthOf(1);
      expect(commitMessages[0]).to.equal('feat: Add new feature\n\nThis is the commit body.');

      const parsedCommit = action.commitData[0];
      expect(parsedCommit.tree).to.equal('1234567890abcdef1234567890abcdef12345678');
      expect(parsedCommit.parent).to.equal('abcdef1234567890abcdef1234567890abcdef12');
      expect(parsedCommit.author).to.equal('Test Author');
      expect(parsedCommit.committer).to.equal('Test Committer');
      expect(parsedCommit.commitTimestamp).to.equal('1678886460');
      expect(parsedCommit.message).to.equal('feat: Add new feature\n\nThis is the commit body.');
      expect(parsedCommit.authorEmail).to.equal('test@example.com');

      expect(step.content.meta).to.deep.equal({
        sig: 'PACK',
        version: 2,
        entries: numEntries,
      });
    });

    it('should handle initial commit (zero hash oldCommit)', async () => {
      const oldCommit = '0'.repeat(40); // Zero hash
      const newCommit = 'b'.repeat(40);
      const ref = 'refs/heads/main';
      const packetLine = `${oldCommit} ${newCommit} ${ref}\0capabilities\n`;

      // Commit content without a parent line
      const commitContent = `tree 1234567890abcdef1234567890abcdef12345678
        author Test Author <test@example.com> 1678886400 +0000
        committer Test Committer <committer@example.com> 1678886460 +0100

        feat: Initial commit`;
      const parentFromCommit = '0'.repeat(40); // Expected parent hash

      const commitContentBuffer = Buffer.from(commitContent, 'utf8');
      zlibInflateStub.returns(commitContentBuffer);

      const packBuffer = createSamplePackBuffer(1, commitContent, 1); // Use real zlib
      req.body = Buffer.concat([createPacketLineBuffer([packetLine]), packBuffer]);

      const result = await exec(req, action);

      expect(result).to.equal(action);
      const step = action.steps.find(s => s.stepName === 'parsePackFile');
      expect(step).to.exist;
      expect(step.error).to.be.false;

      expect(action.branch).to.equal(ref);
      expect(action.setCommit.calledOnceWith(oldCommit, newCommit)).to.be.true;

      // commitFrom should still be the zero hash
      expect(action.commitFrom).to.equal(oldCommit);
      expect(action.commitTo).to.equal(newCommit);
      expect(action.user).to.equal('Test Committer');

      // Check parsed commit data reflects no parent (zero hash)
      expect(action.commitData[0].parent).to.equal(parentFromCommit);
    });

    it('should handle commit with multiple parents (merge commit)', async () => {
      const oldCommit = 'a'.repeat(40);
      const newCommit = 'c'.repeat(40); // Merge commit hash
      const ref = 'refs/heads/main';
      const packetLine = `${oldCommit} ${newCommit} ${ref}\0capabilities\n`;

      const parent1 = 'b1'.repeat(20);
      const parent2 = 'b2'.repeat(20);
      const commitContent = `tree 1234567890abcdef1234567890abcdef12345678
        parent ${parent1}
        parent ${parent2}
        author Test Author <test@example.com> 1678886400 +0000
        committer Test Committer <committer@example.com> 1678886460 +0100

        Merge branch 'feature'`;

      const commitContentBuffer = Buffer.from(commitContent, 'utf8');
      zlibInflateStub.returns(commitContentBuffer);

      const packBuffer = createSamplePackBuffer(1, commitContent, 1); // Use real zlib
      req.body = Buffer.concat([createPacketLineBuffer([packetLine]), packBuffer]);

      const result = await exec(req, action);
      expect(result).to.equal(action);

      // Check step and action properties
      const step = action.steps.find(s => s.stepName === 'parsePackFile');
      expect(step).to.exist;
      expect(step.error).to.be.false;

      expect(action.branch).to.equal(ref);
      expect(action.setCommit.calledOnceWith(oldCommit, newCommit)).to.be.true;
      expect(action.commitFrom).to.equal(oldCommit);
      expect(action.commitTo).to.equal(newCommit);

      // Parent should be the FIRST parent in the commit content
      expect(action.commitData[0].parent).to.equal(parent1);
    });

    it('should add error step if getCommitData throws error', async () => {
      const oldCommit = 'a'.repeat(40);
      const newCommit = 'b'.repeat(40);
      const ref = 'refs/heads/main';
      const packetLine = `${oldCommit} ${newCommit} ${ref}\0capabilities\n`;

      // Malformed commit content - missing tree line
      const commitContent = `parent abcdef1234567890abcdef1234567890abcdef12
        author Test Author <test@example.com> 1678886400 +0000
        committer Test Committer <committer@example.com> 1678886460 +0100

        feat: Missing tree`;
      const commitContentBuffer = Buffer.from(commitContent, 'utf8');
      zlibInflateStub.returns(commitContentBuffer);

      const packBuffer = createSamplePackBuffer(1, commitContent, 1);
      req.body = Buffer.concat([createPacketLineBuffer([packetLine]), packBuffer]);

      const result = await exec(req, action);
      expect(result).to.equal(action);

      const step = action.steps.find(s => s.stepName === 'parsePackFile');
      expect(step).to.exist;
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('Invalid commit data: Missing tree');
    });
  });

});
