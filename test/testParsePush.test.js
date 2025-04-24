const { expect } = require('chai');
const sinon = require('sinon');
const zlib = require('zlib');

const {
  exec,
  getCommitData,
  getPackMeta,
  parsePacketLines,
  unpack
} = require('../src/proxy/processors/push-action/parsePush');

/**
 * Creates a simplified sample PACK buffer for testing.
 * @param {number} numEntries - Number of entries in the PACK file.
 * @param {string} commitContent - Content of the commit object.
 * @param {number} type - Type of the object (1 for commit).
 * @return {Buffer} - The generated PACK buffer.
 */ 
function createSamplePackBuffer(
  numEntries = 1,
  commitContent = 'tree 123\nparent 456\nauthor A <a@a> 123 +0000\ncommitter C <c@c> 456 +0000\n\nmessage',
  type = 1,
) {
  const header = Buffer.alloc(12);
  header.write('PACK', 0, 4, 'utf-8'); // Signature
  header.writeUInt32BE(2, 4); // Version
  header.writeUInt32BE(numEntries, 8); // Number of entries

  const originalContent = Buffer.from(commitContent, 'utf8');
  const compressedContent = zlib.deflateSync(originalContent); // actual zlib for setup

  // Basic type/size encoding (assumes small sizes for simplicity)
  // Real PACK files use variable-length encoding for size
  let typeAndSize = (type << 4) | (compressedContent.length & 0x0f); // Lower 4 bits of size
  if (compressedContent.length >= 16) {
    typeAndSize |= 0x80;
  }
  const objectHeader = Buffer.from([typeAndSize]); // Placeholder, actual size encoding is complex

  // Combine parts and append checksum
  const packContent = Buffer.concat([objectHeader, compressedContent]);
  const checksum = Buffer.alloc(20);

  return Buffer.concat([header, packContent, checksum]);
}

/**
 * Creates a packet line buffer from an array of lines.
 * Each line is prefixed with its length in hex format, and the last line is a flush packet.
 * @param {string[]} lines - Array of lines to be included in the buffer.
 * @return {Buffer} - The generated buffer containing the packet lines.
 */
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
      expect(step.errorMessage).to.include('PACK data is missing');

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
        author Test Author <author@example.com> 1234567890 +0000
        committer Test Committer <committer@example.com> 1234567890 +0000

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
      expect(parsedCommit.commitTimestamp).to.equal('1234567890');
      expect(parsedCommit.message).to.equal('feat: Add new feature\n\nThis is the commit body.');
      expect(parsedCommit.authorEmail).to.equal('author@example.com');

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
        author Test Author <test@example.com> 1234567890 +0000
        committer Test Committer <committer@example.com> 1234567890 +0100

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
        author Test Author <test@example.com> 1234567890 +0000
        committer Test Committer <committer@example.com> 1234567890 +0100

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
        author Test Author <author@example.com> 1678886400 +0000
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

    it('should add error step if data after flush packet does not start with "PACK"', async () => {
      const oldCommit = 'a'.repeat(40);
      const newCommit = 'b'.repeat(40);
      const ref = 'refs/heads/main';
      const packetLines = [`${oldCommit} ${newCommit} ${ref}\0capa\n`];
    
      const packetLineBuffer = createPacketLineBuffer(packetLines);
      const garbageData = Buffer.from('NOT PACK DATA');
      req.body = Buffer.concat([packetLineBuffer, garbageData]);

      const result = await exec(req, action);
      expect(result).to.equal(action);

      const step = action.steps[0];
      expect(step.stepName).to.equal('parsePackFile');
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('Invalid PACK data structure');
      expect(step.errorMessage).to.not.include('PACK data is missing');

      expect(action.branch).to.equal(ref);
      expect(action.setCommit.calledOnceWith(oldCommit, newCommit)).to.be.true;
    });

    it('should correctly identify PACK data even if "PACK" appears in packet lines', async () => {
      const oldCommit = 'a'.repeat(40);
      const newCommit = 'b'.repeat(40);
      const ref = 'refs/heads/develop';
      const packetLines = [
        `${oldCommit} ${newCommit} ${ref}\0capa\n`,
        'some other data containing PACK keyword', // Include "PACK" within a packet line's content
      ];

      const commitContent = `tree 1234567890abcdef1234567890abcdef12345678
        parent ${oldCommit}
        author Test Author <author@example.com> 1234567890 +0000
        committer Test Committer <committer@example.com> 1234567890 +0000
        
        Test commit message with PACK inside`;
      const samplePackBuffer = createSamplePackBuffer(1, commitContent, 1);

      zlibInflateStub.returns(Buffer.from(commitContent, 'utf8'));

      const packetLineBuffer = createPacketLineBuffer(packetLines);
      req.body = Buffer.concat([packetLineBuffer, samplePackBuffer]);

      const result = await exec(req, action);
      expect(result).to.equal(action);
      expect(action.steps.length).to.equal(1);

      // Check that the step was added correctly, and no error present
      const step = action.steps[0];
      expect(step.stepName).to.equal('parsePackFile');
      expect(step.error).to.be.false;
      expect(step.errorMessage).to.be.null;

      // Verify action properties were parsed correctly
      expect(action.branch).to.equal(ref);
      expect(action.setCommit.calledOnceWith(oldCommit, newCommit)).to.be.true;
      expect(action.commitFrom).to.equal(oldCommit);
      expect(action.commitTo).to.equal(newCommit);
      expect(action.commitData).to.be.an('array').with.lengthOf(1);
      expect(action.commitData[0].message).to.equal('Test commit message with PACK inside');
      expect(action.commitData[0].committer).to.equal('Test Committer');
      expect(action.user).to.equal('Test Committer');
    });

    it('should handle PACK data starting immediately after flush packet', async () => {
      const oldCommit = 'a'.repeat(40);
      const newCommit = 'b'.repeat(40);
      const ref = 'refs/heads/master';
      const packetLines = [`${oldCommit} ${newCommit} ${ref}\0`];

      const commitContent = `tree 1234567890abcdef1234567890abcdef12345678
        parent ${oldCommit}
        author Test Author <author@example.com> 1234567890 +0000
        committer Test Committer <committer@example.com> 1234567890 +0000
        
        Commit A`;
      const samplePackBuffer = createSamplePackBuffer(1, commitContent, 1);
      zlibInflateStub.returns(Buffer.from(commitContent, 'utf8'));

      const packetLineBuffer = createPacketLineBuffer(packetLines);
      req.body = Buffer.concat([packetLineBuffer, samplePackBuffer]);

      const result = await exec(req, action);

      expect(result).to.equal(action);
      const step = action.steps[0];
      expect(step.error).to.be.false;
      expect(action.commitData[0].message).to.equal('Commit A');
    });

    it('should add error step if PACK header parsing fails (getPackMeta with wrong signature)', async () => {
      const oldCommit = 'a'.repeat(40);
      const newCommit = 'b'.repeat(40);
      const ref = 'refs/heads/fix';
      const packetLines = [`${oldCommit} ${newCommit} ${ref}\0capa\n`];

      const packetLineBuffer = createPacketLineBuffer(packetLines);
      const badPackBuffer = createSamplePackBuffer();
      badPackBuffer.write('AAAA', 0, 4, 'utf-8'); // Invalid signature, should be 'PACK'

      req.body = Buffer.concat([packetLineBuffer, badPackBuffer]);

      const result = await exec(req, action);
      expect(result).to.equal(action);

      const step = action.steps[0];
      expect(step.stepName).to.equal('parsePackFile');
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('Invalid PACK data structure');
    });
  });

  describe('getPackMeta', () => {
    it('should correctly parse PACK header', () => {
      const buffer = createSamplePackBuffer(5); // 5 entries
      const [meta, contentBuff] = getPackMeta(buffer);

      expect(meta).to.deep.equal({
        sig: 'PACK',
        version: 2,
        entries: 5,
      });
      expect(contentBuff).to.be.instanceOf(Buffer);
      expect(contentBuff.length).to.equal(buffer.length - 12); // Remaining buffer after header
    });

    it('should handle buffer exactly 12 bytes long', () => {
      const buffer = createSamplePackBuffer(1).slice(0, 12); // Only header
        const [meta, contentBuff] = getPackMeta(buffer);

        expect(meta).to.deep.equal({
          sig: 'PACK',
          version: 2,
          entries: 1,
        });
      expect(contentBuff.length).to.equal(0); // No content left
    });
  });

  describe('unpack', () => {
    let deflateStub;

    beforeEach(() => {
      // Need to stub deflate for unpack tests
      deflateStub = sandbox.stub(zlib, 'deflateSync');
    });

    it('should call zlib.inflateSync and zlib.deflateSync', () => {
      const inputBuf = Buffer.from('compressed data');
      const inflatedBuffer = Buffer.from('uncompressed data', 'utf8');
      const deflatedResult = Buffer.from('re-deflated'); // Mock deflated buffer

      zlibInflateStub.withArgs(inputBuf).returns(inflatedBuffer);
      deflateStub.withArgs(inflatedBuffer).returns(deflatedResult);

      const [resultString, resultLength] = unpack(inputBuf);

      expect(zlibInflateStub.calledOnceWith(inputBuf)).to.be.true;
      expect(deflateStub.calledOnceWith(inflatedBuffer)).to.be.true; // Check local stub
      expect(resultString).to.equal(inflatedBuffer.toString('utf8'));
      expect(resultLength).to.equal(deflatedResult.length); // unpack returns length of the deflated buffer
    });

    it('should return inflated string and deflated length', () => {
      const inputBuf = Buffer.from('dummy compressed');
      const inflatedBuffer = Buffer.from('real uncompressed text', 'utf8');
      const deflatedResult = Buffer.from('tiny'); // Different length

      zlibInflateStub.withArgs(inputBuf).returns(inflatedBuffer);
      deflateStub.withArgs(inflatedBuffer).returns(deflatedResult);

      const [content, size] = unpack(inputBuf);

      expect(content).to.equal(inflatedBuffer.toString('utf8'));
      expect(size).to.equal(deflatedResult.length);
    });
  });

  describe('getCommitData', () => {
    it('should return empty array if no type 1 contents', () => {
      const contents = [{ type: 2, content: 'blob' }, { type: 3, content: 'tree' }];
      expect(getCommitData(contents)).to.deep.equal([]);
    });

    it('should parse a single valid commit object', () => {
      const commitContent = `tree 123\nparent 456\nauthor Au Thor <a@e.com> 111 +0000\ncommitter Com Itter <c@e.com> 222 +0100\n\nCommit message here`;
      const contents = [{ type: 1, content: commitContent }];
      const result = getCommitData(contents);

      expect(result).to.be.an('array').with.lengthOf(1);
      expect(result[0]).to.deep.equal({
        tree: '123',
        parent: '456',
        author: 'Au Thor',
        committer: 'Com Itter',
        commitTimestamp: '222',
        message: 'Commit message here',
        authorEmail: 'a@e.com',
      });
    });

    it('should parse multiple valid commit objects', () => {
      const commit1 = `tree 111\nparent 000\nauthor A1 <a1@e.com> 1678880001 +0000\ncommitter C1 <c1@e.com> 1678880002 +0000\n\nMsg1`;
      const commit2 = `tree 222\nparent 111\nauthor A2 <a2@e.com> 1678880003 +0100\ncommitter C2 <c2@e.com> 1678880004 +0100\n\nMsg2`;
      const contents = [
        { type: 1, content: commit1 },
        { type: 3, content: 'tree data' }, // non-commit types must be ignored
        { type: 1, content: commit2 },
      ];

      const result = getCommitData(contents);
      expect(result).to.be.an('array').with.lengthOf(2);

      // Check first commit data
      expect(result[0].message).to.equal('Msg1');
      expect(result[0].parent).to.equal('000');
      expect(result[0].author).to.equal('A1');
      expect(result[0].committer).to.equal('C1');
      expect(result[0].authorEmail).to.equal('a1@e.com');
      expect(result[0].commitTimestamp).to.equal('1678880002');

      // Check second commit data
      expect(result[1].message).to.equal('Msg2');
      expect(result[1].parent).to.equal('111');
      expect(result[1].author).to.equal('A2');
      expect(result[1].committer).to.equal('C2');
      expect(result[1].authorEmail).to.equal('a2@e.com');
      expect(result[1].commitTimestamp).to.equal('1678880004');
    });

    it('should default parent to zero hash if not present', () => {
      const commitContent = `tree 123\nauthor Au Thor <a@e.com> 111 +0000\ncommitter Com Itter <c@e.com> 222 +0100\n\nCommit message here`;
      const contents = [{ type: 1, content: commitContent }];
      const result = getCommitData(contents);
      expect(result[0].parent).to.equal('0'.repeat(40));
    });

    it('should handle commit messages with multiple lines', () => {
      const commitContent = `tree 123\nparent 456\nauthor A <a@e.com> 111 +0000 1\ncommitter C <c@e.com> 2\n\nLine one\nLine two\n\nLine four`;
      const contents = [{ type: 1, content: commitContent }];
      const result = getCommitData(contents);
      expect(result[0].message).to.equal('Line one\nLine two\n\nLine four');
    });

    it('should throw error for invalid commit data (missing tree)', () => {
      const commitContent = `parent 456\nauthor A <a@e.com> 1\ncommitter C <c@e.com> 2\n\nMsg`;
      const contents = [{ type: 1, content: commitContent }];
      expect(() => getCommitData(contents)).to.throw('Invalid commit data');
    });

    it('should throw error for invalid commit data (missing author)', () => {
      const commitContent = `tree 123\nparent 456\ncommitter C <c@e.com> 2\n\nMsg`;
      const contents = [{ type: 1, content: commitContent }];
      expect(() => getCommitData(contents)).to.throw('Invalid commit data');
    });

    it('should throw error for invalid commit data (missing committer)', () => {
      const commitContent = `tree 123\nparent 456\nauthor A <a@e.com> 1\n\nMsg`;
      const contents = [{ type: 1, content: commitContent }];
      expect(() => getCommitData(contents)).to.throw('Invalid commit data');
    });

    it('should throw error for invalid commit data (missing message separator)', () => {
      const commitContent = `tree 123\nparent 456\nauthor A <a@e.com> 1\ncommitter C <c@e.com> 2`; // No empty line
      const contents = [{ type: 1, content: commitContent }];
      expect(() => getCommitData(contents)).to.throw('Invalid commit data');
    });
  });

  describe('parsePacketLines', () => {
    it('should parse multiple valid packet lines correctly and return the correct offset', () => {
      const lines = [
        'line1 content',
        'line2 more content\nwith newline',
        'line3',
      ];
      const buffer = createPacketLineBuffer(lines); // Helper adds "0000" at the end
      const expectedOffset = buffer.length; // Should indicate the end of the buffer after flush packet
      const [parsedLines, offset] = parsePacketLines(buffer);

      expect(parsedLines).to.deep.equal(lines);
      expect(offset).to.equal(expectedOffset);
    });

    it('should handle an empty input buffer', () => {
      const buffer = Buffer.alloc(0);
      const [parsedLines, offset] = parsePacketLines(buffer);

      expect(parsedLines).to.deep.equal([]);
      expect(offset).to.equal(0);
    });

    it('should handle a buffer only with a flush packet', () => {
      const buffer = Buffer.from('0000');
      const [parsedLines, offset] = parsePacketLines(buffer);

      expect(parsedLines).to.deep.equal([]);
      expect(offset).to.equal(4);
    });

    it('should handle lines with null characters correctly', () => {
      const lines = ['line1\0capability=value', 'line2'];
      const buffer = createPacketLineBuffer(lines);
      const expectedOffset = buffer.length;
      const [parsedLines, offset] = parsePacketLines(buffer);

      expect(parsedLines).to.deep.equal(lines);
      expect(offset).to.equal(expectedOffset);
    });

    it('should stop parsing at the first flush packet', () => {
      const lines = ['line1', 'line2'];
      let buffer = createPacketLineBuffer(lines);

      // Add extra data after the flush packet
      const extraData = Buffer.from('extradataafterflush');
      buffer = Buffer.concat([buffer, extraData]);

      const expectedOffset = buffer.length - extraData.length;
      const [parsedLines, offset] = parsePacketLines(buffer);  

      expect(parsedLines).to.deep.equal(lines);
      expect(offset).to.equal(expectedOffset);
    });

    it('should throw an error if a packet line length exceeds buffer bounds', () => {
      // 000A -> length 10, but actual line length is only 3 bytes
      const invalidLengthBuffer = Buffer.from('000Aabc');
      expect(() => parsePacketLines(invalidLengthBuffer)).to.throw(/Invalid packet line length 000A/);
    });

    it('should throw an error for non-hex length prefix (all non-hex)', () => {
      const invalidHexBuffer = Buffer.from('XXXXline');
      expect(() => parsePacketLines(invalidHexBuffer)).to.throw(/Invalid packet line length XXXX/);
    });

    it('should throw an error for non-hex length prefix (non-hex at the end)', () => {
      // Cover the quirk of parseInt returning 0 instead of NaN
      const invalidHexBuffer = Buffer.from('000zline');
      expect(() => parsePacketLines(invalidHexBuffer)).to.throw(/Invalid packet line length 000z/);
    });

     it('should handle buffer ending exactly after a valid line length without content', () => {
      // 0008 -> length 8, but buffer ends after header (no content)
      const incompleteBuffer = Buffer.from('0008');
      expect(() => parsePacketLines(incompleteBuffer)).to.throw(/Invalid packet line length 0008/);
    });
  });
});
