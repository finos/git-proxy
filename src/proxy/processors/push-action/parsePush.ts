import { Action, Step } from '../../actions';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import lod from 'lodash';
import { CommitContent, PersonLine } from '../types';
import {
  BRANCH_PREFIX,
  EMPTY_COMMIT_HASH,
  PACK_SIGNATURE,
  PACKET_SIZE,
} from '../constants';

const BitMask = require('bit-mask') as any;

const dir = path.resolve(__dirname, './.tmp');

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Executes the parsing of a push request.
 * @param {*} req - The request object containing the push data.
 * @param {Action} action - The action object to be modified.
 * @return {Promise<Action>} The modified action object.
 */
async function exec(req: any, action: Action): Promise<Action> {
  const step = new Step('parsePackFile');

  try {
    if (!req.body || req.body.length === 0) {
      step.log('No data received in request body.');
      step.setError('Your push has been blocked. No data received in request body.');
      action.addStep(step);
      return action;
    }
    const [packetLines, packDataOffset] = parsePacketLines(req.body);
    const refUpdates = packetLines.filter((line) => line.includes(BRANCH_PREFIX));

    if (refUpdates.length !== 1) {
      step.log('Invalid number of branch updates.');
      step.log(`Expected 1, but got ${refUpdates.length}`);
      step.setError('Your push has been blocked. Please make sure you are pushing to a single branch.');
      action.addStep(step);
      return action;
    }

    const parts = refUpdates[0].split(' ');
    const [oldCommit, newCommit, ref] = parts;

    action.branch = ref.replace(/\0.*/, '').trim();
    action.setCommit(oldCommit, newCommit);

    // Check if the offset is valid and if there's data after it
    if (packDataOffset >= req.body.length) {
      step.log('No PACK data found after packet lines.');
      step.setError('Your push has been blocked. PACK data is missing.');
      action.addStep(step);
      return action;
    }

    const buf = req.body.slice(packDataOffset);

    // Verify that data actually starts with PACK signature
    if (buf.length < PACKET_SIZE || buf.toString('utf8', 0, PACKET_SIZE) !== PACK_SIGNATURE) {
      step.log(`Expected PACK signature at offset ${packDataOffset}, but found something else.`);
      step.setError('Your push has been blocked. Invalid PACK data structure.');
      action.addStep(step);
      return action;
    }

    const [meta, contentBuff] = getPackMeta(buf);
    const contents = getContents(contentBuff as any, meta.entries as number);

    action.commitData = getCommitData(contents as any);
    if (action.commitData.length === 0) {
      step.log('No commit data found when parsing push.')
    } else {
      if (action.commitFrom === EMPTY_COMMIT_HASH) {
        action.commitFrom = action.commitData[action.commitData.length - 1].parent;
      }
      const user = action.commitData[action.commitData.length - 1].committer;
      action.user = user;  
    }

    const user = action.commitData[action.commitData.length - 1].committer;
    console.log(`Push Request received from user ${user}`);
    action.user = user;

    step.content = {
      meta: meta,
    };
  } catch (e: any) {
    step.setError(
      `Unable to parse push. Please contact an administrator for support: ${e.toString('utf-8')}`,
    );
  } finally {
    action.addStep(step);
  }
  return action;
};

/**
 * Parses the name, email, and timestamp from an author or committer line.
 * 
 * Timestamp including timezone offset is required.
 * @param {string} line - The line to parse.
 * @return {Object} An object containing the name, email, and timestamp.
 */
const parsePersonLine = (line: string): PersonLine => {
  const personRegex = /^(.*?) <(.*?)> (\d+) ([+-]\d+)$/;
  const match = line.match(personRegex);
  if (!match) {
    throw new Error(`Failed to parse person line: ${line}. Make sure to include a name, email, timestamp and timezone offset.`);
  }
  return { name: match[1].trim(), email: match[2], timestamp: match[3] };
};

/**
 * Parses the header lines of a commit.
 * @param {string[]} headerLines - The header lines of a commit.
 * @return {Object} An object containing the parsed data.
 */
const getParsedData = (headerLines: string[]) => {
  const parsedData: {
    tree?: string;
    parents: string[];
    authorInfo?: PersonLine;
    committerInfo?: PersonLine;
  } = { parents: [] };

  for (const line of headerLines) {
    const spaceIndex = line.indexOf(' ');
    if (spaceIndex === -1) continue;

    const key = line.substring(0, spaceIndex);
    const value = line.substring(spaceIndex + 1);

    switch (key) {
      case 'tree':
        parsedData.tree = value.trim();
        break;
      case 'parent':
        parsedData.parents.push(value.trim());
        break;
      case 'author':
        parsedData.authorInfo = parsePersonLine(value);
        break;
      case 'committer':
        parsedData.committerInfo = parsePersonLine(value);
        break;
    }
  }
  return parsedData;
};

/**
 * Parses the commit data from the contents of a pack file.
 * @param {CommitContent[]} contents - The contents of the pack file.
 * @return {*} An array of commit data objects.
 */
const getCommitData = (contents: CommitContent[]) => {
  console.log({ contents });
  return lod
    .chain(contents)
    .filter({ type: 1 })
    .map((x: CommitContent) => {
      console.log({ x });

      const allLines = x.content.split('\n');
      let headerEndIndex = -1;

      // First empty line marks end of header
      for (let i = 0; i < allLines.length; i++) {
        if (allLines[i] === '') {
          headerEndIndex = i;
          break;
        }
      }

      // Commit has no message body or may be malformed
      if (headerEndIndex === -1) {
        // Treat as commit with no message body, header format is checked later
        headerEndIndex = allLines.length;
      }

      const headerLines = allLines.slice(0, headerEndIndex);
      const message = allLines.slice(headerEndIndex + 1).join('\n').trim();
      console.log({ headerLines, message });

      const { tree, parents, authorInfo, committerInfo } = getParsedData(headerLines);
      // No parent headers -> zero hash
      const parent = parents.length > 0 ? parents[0] : EMPTY_COMMIT_HASH;

      // Validation for required attributes
      if (!tree || !authorInfo || !committerInfo) {
        const missing = [];
        if (!tree) missing.push('tree');
        if (!authorInfo) missing.push('author');
        if (!committerInfo) missing.push('committer');
        throw new Error(`Invalid commit data: Missing ${missing.join(', ')}`);
      }

      return {
        tree,
        parent,
        author: authorInfo.name,
        committer: committerInfo.name,
        authorEmail: authorInfo.email,
        commitTimestamp: committerInfo.timestamp,
        message,
      };
    })
    .value();
};

/**
 * Gets the metadata from a pack file.
 * @param {Buffer} buffer - The buffer containing the pack file data.
 * @return {Array} An array containing the metadata and the remaining buffer.
 */
const getPackMeta = (buffer: Buffer) => {
  const sig = buffer.slice(0, PACKET_SIZE).toString('utf-8');
  const version = buffer.readUIntBE(PACKET_SIZE, PACKET_SIZE);
  const entries = buffer.readUIntBE(PACKET_SIZE * 2, PACKET_SIZE);

  const meta = {
    sig: sig,
    version: version,
    entries: entries,
  };

  return [meta, buffer.slice(PACKET_SIZE * 3)];
};

/**
 * Gets the contents of a pack file.
 * @param {Buffer} buffer - The buffer containing the pack file data.
 * @param {number} entries - The number of entries in the pack file.
 * @return {CommitContent[]} An array of commit content objects.
 */
const getContents = (buffer: Buffer | CommitContent[], entries: number) => {
  const contents = [];

  for (let i = 0; i < entries; i++) {
    try {
      const [content, nextBuffer] = getContent(i, buffer as Buffer);
      buffer = nextBuffer as Buffer;
      contents.push(content);
    } catch (e) {
      console.log(e);
    }
  }
  return contents;
};

/**
 * Converts an array of bits to an integer.
 * @param {boolean[]} bits - The array of bits.
 * @return {number} The integer value.
 */
const getInt = (bits: boolean[]) => {
  let strBits = '';

  // eslint-disable-next-line guard-for-in
  for (const i in bits) {
    strBits += bits[i] ? 1 : 0;
  }

  return parseInt(strBits, 2);
};

/**
 * Gets the content of a pack file entry.
 * @param {number} item - The index of the entry.
 * @param {Buffer} buffer - The buffer containing the pack file data.
 * @return {Array} An array containing the content object and the next buffer.
 */
const getContent = (item: number, buffer: Buffer) => {
  // FIRST byte contains the type and some of the size of the file
  // a MORE flag -8th byte tells us if there is a subsequent byte
  // which holds the file size

  const byte = buffer.readUIntBE(0, 1);
  const m = new BitMask(byte);

  let more = m.getBit(3);
  let size = [m.getBit(7), m.getBit(8), m.getBit(9), m.getBit(10)];
  const type = getInt([m.getBit(4), m.getBit(5), m.getBit(6)]);

  // Object IDs if this is a deltatfied blob
  let objectRef: string | null = null;

  // If we have a more flag get the next
  // 8 bytes
  while (more) {
    buffer = buffer.slice(1);
    const nextByte = buffer.readUIntBE(0, 1);
    const nextM = new BitMask(nextByte);

    const nextSize = [
      nextM.getBit(4),
      nextM.getBit(5),
      nextM.getBit(6),
      nextM.getBit(7),
      nextM.getBit(8),
      nextM.getBit(9),
      nextM.getBit(10),
    ];

    size = nextSize.concat(size);
    more = nextM.getBit(3);
  }

  // NOTE Size is the unziped size, not the zipped size
  const intSize = getInt(size);

  // Deltafied objectives have a 20 byte identifer
  if (type == 7 || type == 6) {
    objectRef = buffer.slice(0, 20).toString('hex');
    buffer = buffer.slice(20);
  }

  const contentBuffer = buffer.slice(1);
  const [content, deflatedSize] = unpack(contentBuffer);

  // NOTE Size is the unziped size, not the zipped size
  // so it's kind of useless for us in terms of reading the stream
  const result = {
    item: item,
    value: byte,
    type: type,
    size: intSize,
    deflatedSize: deflatedSize,
    objectRef: objectRef,
    content: content,
  };

  // Move on by the zipped content size.
  const nextBuffer = contentBuffer.slice(deflatedSize as number);

  return [result, nextBuffer];
};

/**
 * Unzips the content of a buffer.
 * @param {Buffer} buf - The buffer containing the zipped content.
 * @return {Array} An array containing the unzipped content and the size of the deflated content.
 */
const unpack = (buf: Buffer) => {
  // Unzip the content
  const inflated = zlib.inflateSync(buf);

  // We don't have IDX files here, so we need to know how
  // big the zipped content was, to set the next read location
  const deflated = zlib.deflateSync(inflated);

  return [inflated.toString('utf8'), deflated.length];
};

/**
 * Parses the packet lines from a buffer into an array of strings.
 * Also returns the offset immediately following the parsed lines (including the flush packet).
 * @param {Buffer} buffer - The buffer containing the packet data.
 * @return {[string[], number]} An array containing the parsed lines and the offset after the last parsed line/flush packet.
 */
const parsePacketLines = (buffer: Buffer): [string[], number] => {
  const lines: string[] = [];
  let offset = 0;

  while (offset + PACKET_SIZE <= buffer.length) {
    const lengthHex = buffer.toString('utf8', offset, offset + PACKET_SIZE);
    const length = Number(`0x${lengthHex}`);

    // Prevent non-hex characters from causing issues
    if (isNaN(length) || length < 0) {
      throw new Error(`Invalid packet line length ${lengthHex} at offset ${offset}`);
    }

    // length of 0 indicates flush packet (0000)
    if (length === 0) {
      offset += PACKET_SIZE; // Include length of the flush packet
      break;
    }

    // Make sure we don't read past the end of the buffer
    if (offset + length > buffer.length) {
        throw new Error(`Invalid packet line length ${lengthHex} at offset ${offset}`);
    }

    const line = buffer.toString('utf8', offset + PACKET_SIZE, offset + length);
    lines.push(line);
    offset += length; // Move offset to the start of the next line's length prefix
  }
  return [lines, offset];
}

exec.displayName = 'parsePush.exec';

export {
  exec,
  getCommitData,
  getPackMeta,
  parsePacketLines,
  unpack
};
