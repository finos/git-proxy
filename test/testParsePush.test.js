const { expect } = require('chai');
const sinon = require('sinon');
const zlib = require('zlib');
const { createHash } = require('crypto');

const {
  exec,
  getCommitData,
  getContents,
  getPackMeta,
  parsePacketLines,
} = require('../src/proxy/processors/push-action/parsePush');

import { EMPTY_COMMIT_HASH, FLUSH_PACKET, PACK_SIGNATURE } from '../src/proxy/processors/constants';

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
  // TODO: extend this to include several commits, blob, ofs_delta and ref_delta entries to test complex decompression cases
  const header = Buffer.alloc(12);
  header.write(PACK_SIGNATURE, 0, 4, 'utf-8'); // Signature
  header.writeUInt32BE(2, 4); // Version
  header.writeUInt32BE(numEntries, 8); // Number of entries

  const originalContent = Buffer.from(commitContent, 'utf8');
  const compressedContent = zlib.deflateSync(originalContent); // actual zlib for setup
  const objectHeader = encodeGitObjectHeader(type, originalContent.length);

  // Combine parts and append checksum
  const packContent = Buffer.concat([objectHeader, compressedContent]);

  const fullPackWithoutChecksum = Buffer.concat([header, packContent]);

  // Compute SHA-1 checksum of the full pack content (excluding checksum)
  const checksum = createHash('sha1').update(fullPackWithoutChecksum).digest();

  return Buffer.concat([fullPackWithoutChecksum, checksum]);
}

const TEST_MULTI_OBJ_COMMIT_CONTENT = [
  {
    type: 1,
    content:
      'tree 163a9d7fcb53daae8f2f26b5aa865a5dbf4dab3e\nparent 5be75c8610b0fcafcca6a777471ba281ff98564f\nauthor AAAAAAAAAA <aaaaaaaaa@bbbbbbbb.com> 1756487408 +0100\ncommitter CCCCCCCCCCC <ccccccccc@cccccccc.com> 1756487404 +0100\n\nFirst Non-trivial commit message used in testing decompression of encoded objects in git PACK files.\n',
    message:
      'First Non-trivial commit message used in testing decompression of encoded objects in git PACK files.\n',
    tree: '163a9d7fcb53daae8f2f26b5aa865a5dbf4dab3e',
    parent: '5be75c8610b0fcafcca6a777471ba281ff98564f',
    author: 'AAAAAAAAAA',
    authorEmail: 'aaaaaaaaa@bbbbbbbb.com',
    committer: 'CCCCCCCCCCC',
    committerEmail: 'ccccccccc@cccccccc.com',
    commitTimestamp: '1756487404',
  },
  {
    type: 1,
    content:
      'tree 263a9d7fcb53daae8f2f26b5aa865a5dbf4dab3e\nparent 6be75c8610b0fcafcca6a777471ba281ff98564f\nauthor AAAAAAAAAA <aaaaaaaaa@bbbbbbbb.com> 1756487407 +0100\ncommitter CCCCCCCCCCC <ccccccccc@cccccccc.com> 1756487403 +0100\n\nSecond Non-trivial commit message used in testing decompression of encoded objects in git PACK files.',
    message:
      'Second Non-trivial commit message used in testing decompression of encoded objects in git PACK files.',
    tree: '263a9d7fcb53daae8f2f26b5aa865a5dbf4dab3e',
    parent: '6be75c8610b0fcafcca6a777471ba281ff98564f',
    author: 'AAAAAAAAAA',
    authorEmail: 'aaaaaaaaa@bbbbbbbb.com',
    committer: 'CCCCCCCCCCC',
    committerEmail: 'ccccccccc@cccccccc.com',
    commitTimestamp: '1756487403',
  },
  {
    type: 1,
    content:
      'tree 363a9d7fcb53daae8f2f26b5aa865a5dbf4dab3e\nparent 7be75c8610b0fcafcca6a777471ba281ff98564f\nauthor AAAAAAAAAA <aaaaaaaaa@bbbbbbbb.com> 1756487406 +0100\ncommitter CCCCCCCCCCC <ccccccccc@cccccccc.com> 1756487402 +0100\n\nThird Non-trivial commit message used in testing decompression of encoded objects in git PACK files.',
    message:
      'Third Non-trivial commit message used in testing decompression of encoded objects in git PACK files.',
    tree: '363a9d7fcb53daae8f2f26b5aa865a5dbf4dab3e',
    parent: '7be75c8610b0fcafcca6a777471ba281ff98564f',
    author: 'AAAAAAAAAA',
    authorEmail: 'aaaaaaaaa@bbbbbbbb.com',
    committer: 'CCCCCCCCCCC',
    committerEmail: 'ccccccccc@cccccccc.com',
    commitTimestamp: '1756487402',
  },
  {
    type: 1,
    content:
      'tree 463a9d7fcb53daae8f2f26b5aa865a5dbf4dab3e\nparent 8be75c8610b0fcafcca6a777471ba281ff98564f\nauthor AAAAAAAAAA <aaaaaaaaa@bbbbbbbb.com> 1756487405 +0100\ncommitter CCCCCCCCCCC <ccccccccc@cccccccc.com> 1756487401 +0100\n\nFourth Non-trivial commit message used in testing decompression of encoded objects in git PACK files.',
    message:
      'Fourth Non-trivial commit message used in testing decompression of encoded objects in git PACK files.',
    tree: '463a9d7fcb53daae8f2f26b5aa865a5dbf4dab3e',
    parent: '8be75c8610b0fcafcca6a777471ba281ff98564f',
    author: 'AAAAAAAAAA',
    authorEmail: 'aaaaaaaaa@bbbbbbbb.com',
    committer: 'CCCCCCCCCCC',
    committerEmail: 'ccccccccc@cccccccc.com',
    commitTimestamp: '1756487401',
  },
  {
    type: 7,
    baseSha: '22d2d1c780390f079532a4851f773324692c0af5',
    content: 'not really a ref_delta',
    message: 'not really a ref_delta',
  },
  { type: 3, content: 'not really a blob\n', message: 'not really a blob\n' },
  {
    type: 6,
    baseOffset: 997,
    content: 'not really an ofs_delta',
    message: 'not really an ofs_delta',
  },
];

/** Creates a multi-object sample PACK buffer for testing PACK file decompression.
 * Creates a relatively large example as decompression steps involve variable length
 * headers depending on content and size.
 * @return {Buffer} - The generated PACK buffer.
 */
function createMultiObjectSamplePackBuffer() {
  const numEntries = TEST_MULTI_OBJ_COMMIT_CONTENT.length;

  const header = Buffer.alloc(12);
  header.write(PACK_SIGNATURE, 0, 4, 'utf-8'); // Signature
  header.writeUInt32BE(2, 4); // Version
  header.writeUInt32BE(numEntries, 8); // Number of entries

  const packContents = [];
  for (let i = 0; i < numEntries; i++) {
    const commitContent = TEST_MULTI_OBJ_COMMIT_CONTENT[i];
    const originalContent = Buffer.from(commitContent.content, 'utf8');
    const compressedContent = zlib.deflateSync(originalContent);
    let objectHeader;
    if (commitContent.type == 7) {
      // ref_delta
      objectHeader = encodeGitObjectHeader(commitContent.type, originalContent.length, {
        baseSha: Buffer.from(commitContent.baseSha, 'hex'),
      });
    } else if (commitContent.type == 6) {
      // ofs_delta
      objectHeader = encodeGitObjectHeader(commitContent.type, originalContent.length, {
        baseOffset: commitContent.baseOffset,
      });
    } else {
      // all other types
      objectHeader = encodeGitObjectHeader(commitContent.type, originalContent.length);
    }

    packContents.push(Buffer.concat([objectHeader, compressedContent]));
  }

  const packContent = Buffer.concat(packContents);
  const fullPackWithoutChecksum = Buffer.concat([header, packContent]);

  // Compute SHA-1 checksum of the full pack content (excluding checksum)
  const checksum = createHash('sha1').update(fullPackWithoutChecksum).digest();

  return Buffer.concat([fullPackWithoutChecksum, checksum]);
}

/**
 * Encode distance in an ofs_delta git object header.
 * @param {number} distance
 * @return {Buffer} encoded distance bytes.
 */

/** Encodes an ofs_delta offset for a type 6 g9it object header.
 * @param {number} distance The offset value to encode.
 * @return {Buffer} The encoded buffer.
 */
const encodeOfsDeltaOffset = (distance) => {
  const bytes = [];
  let val = distance;

  while (val >= 0x80) {
    bytes.push((val & 0x7f) | 0x80); // Set continuation bit
    val >>= 7;
  }
  bytes.push(val); // Final byte without continuation bit

  return Buffer.from(bytes);
};

/**
 * Encodes Git object headers used in PACK files, for testing.
 * @param {number} type - Git object type (1–4 for base types, 6 for ofs_delta, 7 for ref_delta).
 * @param {number} size - Uncompressed object size in bytes.
 * @param {object} [options] - Optional metadata for delta types.
 * @param {number} [options.baseOffset] - Offset for ofs_delta.
 * @param {Buffer} [options.baseSha] - SHA-1 hash for ref_delta (20 bytes).
 * @return {Buffer} - Encoded header buffer.
 */
function encodeGitObjectHeader(type, size, options = {}) {
  const headerBytes = [];

  // TODO: add handling for ofs_delta and ref_delta headers

  // First byte: type (3 bits), size (lower 4 bits), continuation bit
  const firstSizeBits = size & 0x0f;
  size >>= 4;

  let byte = (type << 4) | firstSizeBits;
  if (size > 0) byte |= 0x80;
  headerBytes.push(byte);

  // Remaining size bytes: 7 bits per byte, continuation bit
  while (size > 0) {
    let nextByte = size & 0x7f;
    size >>= 7;
    if (size > 0) nextByte |= 0x80;
    headerBytes.push(nextByte);
  }

  // Handle delta metadata
  if (type === 6) {
    // OFS_DELTA: encode base offset as variable-length
    if (typeof options.baseOffset !== 'number') {
      throw new Error('ofs_delta requires baseOffset');
    }
    const offsetBytes = encodeOfsDeltaOffset(options.baseOffset);
    headerBytes.push(...offsetBytes);
  } else if (type === 7) {
    // REF_DELTA: append 20-byte SHA-1
    if (!Buffer.isBuffer(options.baseSha)) {
      throw new Error('ref_delta requires a baseSha as a buffer');
    }
    if (options.baseSha.length !== 20) {
      throw new Error(
        `ref_delta requires a 20-byte Buffer representing the baseSha, yours was length ${options.baseSha.length}}`,
      );
    }
    headerBytes.push(...options.baseSha);
  }

  return Buffer.from(headerBytes);
}

/**
 * Creates a packet line buffer from an array of lines.
 * Each line is prefixed with its length in hex format, and the last line is a flush packet.
 * @param {string[]} lines - Array of lines to be included in the buffer.
 * @return {Buffer} - The generated buffer containing the packet lines.
 */
function createPacketLineBuffer(lines) {
  let buffer = Buffer.alloc(0);
  lines.forEach((line) => {
    const lengthInHex = (line.length + 4).toString(16).padStart(4, '0');
    buffer = Buffer.concat([buffer, Buffer.from(lengthInHex, 'ascii'), Buffer.from(line, 'ascii')]);
  });
  buffer = Buffer.concat([buffer, Buffer.from(FLUSH_PACKET, 'ascii')]);

  return buffer;
}

/**
 * Creates an empty PACK buffer for testing.
 * @return {Buffer} - The generated buffer containing the PACK header and checksum.
 */
function createEmptyPackBuffer() {
  const header = Buffer.alloc(12);
  header.write(PACK_SIGNATURE, 0, 4, 'utf-8'); // signature
  header.writeUInt32BE(2, 4); // version
  header.writeUInt32BE(0, 8); // number of entries

  const checksum = Buffer.alloc(20); // fake checksum (all zeros)
  return Buffer.concat([header, checksum]);
}

describe('parsePackFile', () => {
  let action;
  let req;
  let sandbox;

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
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('parsePush.getContents', () => {
    it('should retrieve all object data from a multiple object push', async () => {
      const packBuffer = createMultiObjectSamplePackBuffer();
      const [packMeta, contentBuffer] = getPackMeta(packBuffer);
      expect(packMeta.entries).to.equal(
        TEST_MULTI_OBJ_COMMIT_CONTENT.length,
        `PACK meta entries (${packMeta.entries}) don't match the expected number (${TEST_MULTI_OBJ_COMMIT_CONTENT.length})`,
      );

      const gitObjects = await getContents(contentBuffer, TEST_MULTI_OBJ_COMMIT_CONTENT.length);

      expect(gitObjects.length).to.equal(
        TEST_MULTI_OBJ_COMMIT_CONTENT.length,
        `The number of objects extracted (${gitObjects.length}) didn't match the expected number (${TEST_MULTI_OBJ_COMMIT_CONTENT.length})`,
      );

      for (let index = 0; index < TEST_MULTI_OBJ_COMMIT_CONTENT.length; index++) {
        const expected = TEST_MULTI_OBJ_COMMIT_CONTENT[index];
        const actual = gitObjects[index];

        expect(actual.type).to.equal(
          expected.type,
          `Type extracted (${actual.type}) didn't match\nactual: ${JSON.stringify(actual, null, 2)}\nexpected: ${JSON.stringify(expected, null, 2)}`,
        );
        expect(actual.content).to.equal(
          expected.content,
          `Content didn't match\nactual: ${JSON.stringify(actual, null, 2)}\nexpected: ${JSON.stringify(expected, null, 2)}`,
        );

        // type 6 ofs_delta
        if (expected.baseOffset) {
          expect(actual.baseOffset).to.equal(
            expected.baseOffset,
            `Base SHA extracted for ofs_delta didn't match\nactual: ${JSON.stringify(actual, null, 2)}\nexpected: ${JSON.stringify(expected, null, 2)}`,
          );
        }
        // type t ref_delta
        if (expected.baseSha) {
          expect(actual.baseSha).to.equal(
            expected.baseSha,
            `Base SHA extracted for ref_delta didn't match\nactual: ${JSON.stringify(actual, null, 2)}\nexpected: ${JSON.stringify(expected, null, 2)}`,
          );
        }
      }
    });
  });

  describe('exec', () => {
    it('should add error step if req.body is missing', async () => {
      req.body = undefined;
      const result = await exec(req, action);

      expect(result).to.equal(action);
      const step = action.steps[0];
      expect(step.stepName).to.equal('parsePackFile');
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('No body found in request');
    });

    it('should add error step if req.body is empty', async () => {
      req.body = Buffer.alloc(0);
      const result = await exec(req, action);

      expect(result).to.equal(action);
      const step = action.steps[0];
      expect(step.stepName).to.equal('parsePackFile');
      expect(step.error).to.be.true;
      expect(step.errorMessage).to.include('No body found in request');
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

      const commitContent =
        'tree 1234567890abcdef1234567890abcdef12345678\n' +
        'parent abcdef1234567890abcdef1234567890abcdef12\n' +
        'author Test Author <author@example.com> 1234567890 +0000\n' +
        'committer Test Committer <committer@example.com> 1234567890 +0000\n\n' +
        'feat: Add new feature\n\n' +
        'This is the commit body.';

      const numEntries = 1;
      const packBuffer = createSamplePackBuffer(numEntries, commitContent, 1); // Use real zlib
      req.body = Buffer.concat([createPacketLineBuffer([packetLine]), packBuffer]);

      const result = await exec(req, action);
      expect(result).to.equal(action);

      // Check step and action properties
      const step = action.steps.find((s) => s.stepName === 'parsePackFile');
      expect(step).to.exist;
      expect(step.error).to.be.false;
      expect(step.errorMessage).to.be.null;

      expect(action.branch).to.equal(ref);
      expect(action.setCommit.calledOnceWith(oldCommit, newCommit)).to.be.true;
      expect(action.commitFrom).to.equal(oldCommit);
      expect(action.commitTo).to.equal(newCommit);
      expect(action.user).to.equal('Test Committer');

      // Check parsed commit data
      const commitMessages = action.commitData.map((commit) => commit.message);
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
        sig: PACK_SIGNATURE,
        version: 2,
        entries: numEntries,
      });
    });

    it('should successfully parse a valid multi-object push request', async () => {
      const oldCommit = 'a'.repeat(40);
      const newCommit = 'b'.repeat(40);
      const ref = 'refs/heads/main';
      const packetLine = `${oldCommit} ${newCommit} ${ref}\0capabilities\n`;

      const packBuffer = createMultiObjectSamplePackBuffer();
      req.body = Buffer.concat([createPacketLineBuffer([packetLine]), packBuffer]);

      const result = await exec(req, action);
      expect(result).to.equal(action);

      // Check step and action properties
      const step = action.steps.find((s) => s.stepName === 'parsePackFile');
      expect(step).to.exist;
      expect(step.error).to.be.false;
      expect(step.errorMessage).to.be.null;

      expect(action.branch).to.equal(ref);
      expect(action.setCommit.calledOnceWith(oldCommit, newCommit)).to.be.true;
      expect(action.commitFrom).to.equal(oldCommit);
      expect(action.commitTo).to.equal(newCommit);
      expect(action.user).to.equal('CCCCCCCCCCC');

      // Check parsed commit messages only
      const expectedCommits = TEST_MULTI_OBJ_COMMIT_CONTENT.filter((value) => value.type == 1);

      expect(action.commitData)
        .to.be.an('array')
        .with.lengthOf(
          expectedCommits.length,
          "We didn't find the expected number of commit messages",
        );

      for (let index = 0; index < expectedCommits.length; index++) {
        expect(action.commitData[index].message).to.equal(
          expectedCommits[index].message.trim(), // trailing new lines will be removed from messages
          "Commit message didn't match",
        );
        expect(action.commitData[index].tree).to.equal(
          expectedCommits[index].tree,
          "tree didn't match",
        );
        expect(action.commitData[index].parent).to.equal(
          expectedCommits[index].parent,
          "parent didn't match",
        );
        expect(action.commitData[index].author).to.equal(
          expectedCommits[index].author,
          "author didn't match",
        );
        expect(action.commitData[index].authorEmail).to.equal(
          expectedCommits[index].authorEmail,
          "authorEmail didn't match",
        );
        expect(action.commitData[index].committer).to.equal(
          expectedCommits[index].committer,
          "committer didn't match",
        );
        expect(action.commitData[index].committerEmail).to.equal(
          expectedCommits[index].committerEmail,
          "committerEmail didn't match",
        );
        expect(action.commitData[index].commitTimestamp).to.equal(
          expectedCommits[index].commitTimestamp,
          "commitTimestamp didn't match",
        );
      }

      expect(step.content.meta).to.deep.equal(
        {
          sig: PACK_SIGNATURE,
          version: 2,
          entries: TEST_MULTI_OBJ_COMMIT_CONTENT.length,
        },
        "PACK file metadata didn't match",
      );
    });

    it('should handle initial commit (zero hash oldCommit)', async () => {
      const oldCommit = '0'.repeat(40); // Zero hash
      const newCommit = 'b'.repeat(40);
      const ref = 'refs/heads/main';
      const packetLine = `${oldCommit} ${newCommit} ${ref}\0capabilities\n`;

      // Commit content without a parent line
      const commitContent =
        'tree 1234567890abcdef1234567890abcdef12345678\n' +
        'author Test Author <test@example.com> 1234567890 +0000\n' +
        'committer Test Committer <committer@example.com> 1234567890 +0100\n\n' +
        'feat: Initial commit';
      const parentFromCommit = '0'.repeat(40); // Expected parent hash

      const packBuffer = createSamplePackBuffer(1, commitContent, 1); // Use real zlib
      req.body = Buffer.concat([createPacketLineBuffer([packetLine]), packBuffer]);

      const result = await exec(req, action);

      expect(result).to.equal(action);
      const step = action.steps.find((s) => s.stepName === 'parsePackFile');
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
      const commitContent =
        'tree 1234567890abcdef1234567890abcdef12345678\n' +
        `parent ${parent1}\n` +
        `parent ${parent2}\n` +
        'author Test Author <test@example.com> 1234567890 +0000\n' +
        'committer Test Committer <committer@example.com> 1234567890 +0100\n\n' +
        "Merge branch 'feature'";

      const packBuffer = createSamplePackBuffer(1, commitContent, 1); // Use real zlib
      req.body = Buffer.concat([createPacketLineBuffer([packetLine]), packBuffer]);

      const result = await exec(req, action);
      expect(result).to.equal(action);

      // Check step and action properties
      const step = action.steps.find((s) => s.stepName === 'parsePackFile');
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
      const commitContent =
        'parent abcdef1234567890abcdef1234567890abcdef12\n' +
        'author Test Author <author@example.com> 1678886400 +0000\n' +
        'committer Test Committer <committer@example.com> 1678886460 +0100\n\n' +
        'feat: Missing tree';

      const packBuffer = createSamplePackBuffer(1, commitContent, 1);
      req.body = Buffer.concat([createPacketLineBuffer([packetLine]), packBuffer]);

      const result = await exec(req, action);
      expect(result).to.equal(action);

      const step = action.steps.find((s) => s.stepName === 'parsePackFile');
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

      const commitContent =
        'tree 1234567890abcdef1234567890abcdef12345678\n' +
        `parent ${oldCommit}\n` +
        'author Test Author <author@example.com> 1234567890 +0000\n' +
        'committer Test Committer <committer@example.com> 1234567890 +0000\n\n' +
        'Test commit message with PACK inside';
      const samplePackBuffer = createSamplePackBuffer(1, commitContent, 1);
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

      const commitContent =
        'tree 1234567890abcdef1234567890abcdef12345678\n' +
        `parent ${oldCommit}\n` +
        'author Test Author <author@example.com> 1234567890 +0000\n' +
        'committer Test Committer <committer@example.com> 1234567890 +0000\n\n' +
        'Commit A';
      const samplePackBuffer = createSamplePackBuffer(1, commitContent, 1);

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

    it('should return empty commitData on empty branch push', async () => {
      const emptyPackBuffer = createEmptyPackBuffer();

      const newCommit = 'b'.repeat(40);
      const ref = 'refs/heads/feature/emptybranch';
      const packetLine = `${EMPTY_COMMIT_HASH} ${newCommit} ${ref}\0capabilities\n`;

      req.body = Buffer.concat([createPacketLineBuffer([packetLine]), emptyPackBuffer]);

      const result = await exec(req, action);

      expect(result).to.equal(action);

      const step = action.steps.find((s) => s.stepName === 'parsePackFile');
      expect(step).to.exist;
      expect(step.error).to.be.false;
      expect(action.branch).to.equal(ref);
      expect(action.setCommit.calledOnceWith(EMPTY_COMMIT_HASH, newCommit)).to.be.true;

      expect(action.commitData).to.be.an('array').with.lengthOf(0);
    });
  });

  describe('getPackMeta', () => {
    it('should correctly parse PACK header', () => {
      const buffer = createSamplePackBuffer(5); // 5 entries
      const [meta, contentBuff] = getPackMeta(buffer);

      expect(meta).to.deep.equal({
        sig: PACK_SIGNATURE,
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
        sig: PACK_SIGNATURE,
        version: 2,
        entries: 1,
      });
      expect(contentBuff.length).to.equal(0); // No content left
    });
  });

  describe('getCommitData', () => {
    it('should return empty array if no type 1 contents', () => {
      const contents = [
        { type: 2, content: 'blob' },
        { type: 3, content: 'tree' },
      ];
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
        committerEmail: 'c@e.com',
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
      const commitContent = `tree 123\nparent 456\nauthor A <a@e.com> 111 +0000\ncommitter C <c@e.com> 222 +0100\n\nLine one\nLine two\n\nLine four`;
      const contents = [{ type: 1, content: commitContent }];
      const result = getCommitData(contents);
      expect(result[0].message).to.equal('Line one\nLine two\n\nLine four');
    });

    it('should handle commits without a message body', () => {
      const commitContent = `tree 123\nparent 456\nauthor A <a@e.com> 111 +0000\ncommitter C <c@e.com> 222 +0100\n`;
      const contents = [{ type: 1, content: commitContent }];
      const result = getCommitData(contents);
      expect(result[0].message).to.equal('');
    });

    it('should throw error for invalid commit data (missing tree)', () => {
      const commitContent = `parent 456\nauthor A <a@e.com> 1234567890 +0000\ncommitter C <c@e.com> 1234567890 +0000\n\nMsg`;
      const contents = [{ type: 1, content: commitContent }];
      expect(() => getCommitData(contents)).to.throw('Invalid commit data: Missing tree');
    });

    it('should throw error for invalid commit data (missing author)', () => {
      const commitContent = `tree 123\nparent 456\ncommitter C <c@e.com> 1234567890 +0000\n\nMsg`;
      const contents = [{ type: 1, content: commitContent }];
      expect(() => getCommitData(contents)).to.throw('Invalid commit data: Missing author');
    });

    it('should throw error for invalid commit data (missing committer)', () => {
      const commitContent = `tree 123\nparent 456\nauthor A <a@e.com> 1234567890 +0000\n\nMsg`;
      const contents = [{ type: 1, content: commitContent }];
      expect(() => getCommitData(contents)).to.throw('Invalid commit data: Missing committer');
    });

    it('should throw error for invalid author line (missing timezone offset)', () => {
      const commitContent = `tree 123\nparent 456\nauthor A <a@e.com> 1234567890\ncommitter C <c@e.com> 1234567890 +0000\n\nMsg`;
      const contents = [{ type: 1, content: commitContent }];
      expect(() => getCommitData(contents)).to.throw('Failed to parse person line');
    });

    it('should correctly parse a commit with a GPG signature header', () => {
      const gpgSignedCommit =
        'tree b4d3c0ffee1234567890abcdef1234567890aabbcc\n' +
        'parent 01dbeef9876543210fedcba9876543210fedcba\n' +
        'author Test Author <test.author@example.com> 1744814600 +0100\n' +
        'committer Test Committer <test.committer@example.com> 1744814610 +0200\n' +
        'gpgsig -----BEGIN PGP SIGNATURE-----\n \n' +
        ' wsFcBAABCAAQBQJn/8ISCRC1aQ7uu5UhlAAAntAQACeyQd6IykNXiN6m9DfVp8DJ\n' +
        ' UsY64ws+Td0inrEee+cHXVI9uJn15RJYQkICwlM4TZsVGav7nYaVqO+gfAg2ORAH\n' +
        ' ghUnwSFFs7ucN/p0a47ItkJmt04+jQIFlZIC+wy1u2H3aKJwqaF+kGP5SA33ahgV\n' +
        ' ZWviKodXFki8/G+sKB63q1qrDw6aELtftEgeAPQUcuLzj+vu/m3dWrDbatfUXMkC\n' +
        ' JC6PbFajqrJ5pEtFwBqqRE+oIsOM9gkNAti1yDD5eoS+bNXACe0hT0+UoIzn5a34\n' +
        ' xcElXTSdAK/MRjGiLN91G2nWvlbpM5wAEqr5Bl5ealCc6BbWfPxbP46slaE5DfkD\n' +
        ' u0+RkVX06MSSPqzOmEV14ZWKap5C19FpF9o/rY8vtLlCxjWMhtUvvdR4OQfQpEDY\n' +
        ' eTqzCHRnM3+7r3ABAWt9v7cG99bIMEs3sGcMy11HMeaoBpye6vCIP4ghNnoB1hUJ\n' +
        ' D7MD77jzk4Kbf4IzS5omExyMu3AiNZecZX4+1w/527yPhv3s/HB1Gfz0oCUned+6\n' +
        ' b9Kkle+krsQ/EK/4gPcb/Kb1cTcm3HhjaOSYwA+JpApJQ0mrduH34AT5MZJuIPFe\n' +
        ' QheLzQI1d2jmFs11GRC5hc0HBk1WmGm6U8+FBuxCX0ECZPdYeQJjUeWjnNeUoE6a\n' +
        ' 5lytZU4Onk57nUhIMSrx\n' +
        ' =IxZr\n' +
        ' -----END PGP SIGNATURE-----\n\n' +
        'This is the commit message.\n' +
        'It can span multiple lines.\n\n' +
        'And include blank lines internally.';

      const contents = [
        { type: 1, content: gpgSignedCommit },
        {
          type: 1,
          content: `tree 111\nparent 000\nauthor A1 <a1@e.com> 1744814600 +0200\ncommitter C1 <c1@e.com> 1744814610 +0200\n\nMsg1`,
        },
      ];

      const result = getCommitData(contents);
      expect(result).to.be.an('array').with.lengthOf(2);

      // Check the GPG signed commit data
      const gpgResult = result[0];
      expect(gpgResult.tree).to.equal('b4d3c0ffee1234567890abcdef1234567890aabbcc');
      expect(gpgResult.parent).to.equal('01dbeef9876543210fedcba9876543210fedcba');
      expect(gpgResult.author).to.equal('Test Author');
      expect(gpgResult.committer).to.equal('Test Committer');
      expect(gpgResult.authorEmail).to.equal('test.author@example.com');
      expect(gpgResult.commitTimestamp).to.equal('1744814610');
      expect(gpgResult.message).to.equal(
        `This is the commit message.\nIt can span multiple lines.\n\nAnd include blank lines internally.`,
      );

      // Sanity check: the second commit should be the simple commit
      const simpleResult = result[1];
      expect(simpleResult.message).to.equal('Msg1');
      expect(simpleResult.parent).to.equal('000');
      expect(simpleResult.author).to.equal('A1');
      expect(simpleResult.committer).to.equal('C1');
      expect(simpleResult.authorEmail).to.equal('a1@e.com');
      expect(simpleResult.commitTimestamp).to.equal('1744814610');
    });
  });

  describe('parsePacketLines', () => {
    it('should parse multiple valid packet lines correctly and return the correct offset', () => {
      const lines = ['line1 content', 'line2 more content\nwith newline', 'line3'];
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
      const buffer = Buffer.from(FLUSH_PACKET);
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
      expect(() => parsePacketLines(invalidLengthBuffer)).to.throw(
        /Invalid packet line length 000A/,
      );
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
