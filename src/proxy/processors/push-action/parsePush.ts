import { Action, Step } from '../../actions';
import fs from 'fs';
import lod from 'lodash';
import { createInflate } from 'zlib';
import { CommitContent, CommitData, CommitHeader, PackMeta, PersonLine } from '../types';
import {
  BRANCH_PREFIX,
  EMPTY_COMMIT_HASH,
  PACK_SIGNATURE,
  PACKET_SIZE,
  GIT_OBJECT_TYPE_COMMIT,
} from '../constants';

const dir = './.tmp/';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
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
      throw new Error('No body found in request');
    }
    const [packetLines, packDataOffset] = parsePacketLines(req.body);
    const refUpdates = packetLines.filter((line) => line.includes(BRANCH_PREFIX));

    if (refUpdates.length !== 1) {
      step.log('Invalid number of branch updates.');
      step.log(`Expected 1, but got ${refUpdates.length}`);
      throw new Error(
        'Your push has been blocked. Please make sure you are pushing to a single branch.',
      );
    } else {
      console.log(`refUpdates: ${JSON.stringify(refUpdates, null, 2)}`);
    }

    const [commitParts] = refUpdates[0].split('\0');
    const parts = commitParts.split(' ');
    if (parts.length !== 3) {
      step.log('Invalid number of parts in ref update.');
      step.log(`Expected 3, but got ${parts.length}`);
      throw new Error('Your push has been blocked. Invalid ref update format.');
    }

    const [oldCommit, newCommit, ref] = parts;

    // Strip everything after NUL, which is cap-list from
    // https://git-scm.com/docs/http-protocol#_smart_server_response
    action.branch = ref.replace(/\0.*/, '').trim();
    action.setCommit(oldCommit, newCommit);

    // Check if the offset is valid and if there's data after it
    if (packDataOffset >= req.body.length) {
      step.log('No PACK data found after packet lines.');
      throw new Error('Your push has been blocked. PACK data is missing.');
    }

    const buf = req.body.slice(packDataOffset);

    // Verify that data actually starts with PACK signature
    if (buf.length < PACKET_SIZE || buf.toString('utf8', 0, PACKET_SIZE) !== PACK_SIGNATURE) {
      step.log(`Expected PACK signature at offset ${packDataOffset}, but found something else.`);
      throw new Error('Your push has been blocked. Invalid PACK data structure.');
    }
    console.log(`buf = ${buf.toString('hex')}`);
    const [meta, contentBuff] = getPackMeta(buf);
    console.log('Pack metadata: ' + JSON.stringify(meta, null, 2));
    console.log(`contentBuff = ${contentBuff.toString('hex')}`);

    const contents = await getContents(contentBuff, meta.entries);

    action.commitData = getCommitData(contents as any);
    console.log('commitData = ' + JSON.stringify(action.commitData));

    if (action.commitData.length === 0) {
      step.log('No commit data found when parsing push.');
    } else {
      if (action.commitFrom === EMPTY_COMMIT_HASH) {
        action.commitFrom = action.commitData[action.commitData.length - 1].parent;
      }

      const { committer, committerEmail } = action.commitData[action.commitData.length - 1];
      console.log(`Push Request received from user ${committer} with email ${committerEmail}`);
      action.user = committer;
      action.userEmail = committerEmail;
    }

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
}

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
    throw new Error(
      `Failed to parse person line: ${line}. Make sure to include a name, email, timestamp and timezone offset.`,
    );
  }
  return { name: match[1], email: match[2], timestamp: match[3] };
};

/**
 * Parses the header lines of a commit.
 * @param {string[]} headerLines - The header lines of a commit.
 * @return {CommitHeader} An object containing the parsed commit header.
 */
const getParsedData = (headerLines: string[]): CommitHeader => {
  const parsedData: CommitHeader = {
    parents: [],
    tree: '',
    author: { name: '', email: '', timestamp: '' },
    committer: { name: '', email: '', timestamp: '' },
  };

  for (const line of headerLines) {
    const firstSpaceIndex = line.indexOf(' ');
    if (firstSpaceIndex === -1) {
      // No spaces
      continue;
    }

    const key = line.substring(0, firstSpaceIndex);
    const value = line.substring(firstSpaceIndex + 1);

    switch (key) {
      case 'tree':
        if (parsedData.tree !== '') {
          throw new Error('Multiple tree lines found in commit.');
        }
        parsedData.tree = value.trim();
        break;
      case 'parent':
        parsedData.parents.push(value.trim());
        break;
      case 'author':
        if (!isBlankPersonLine(parsedData.author)) {
          throw new Error('Multiple author lines found in commit.');
        }
        parsedData.author = parsePersonLine(value);
        break;
      case 'committer':
        if (!isBlankPersonLine(parsedData.committer)) {
          throw new Error('Multiple committer lines found in commit.');
        }
        parsedData.committer = parsePersonLine(value);
        break;
    }
  }
  validateParsedData(parsedData);
  return parsedData;
};

/**
 * Validates the parsed commit header.
 * @param {CommitHeader} parsedData - The parsed commit header.
 * @return {void}
 * @throws {Error} If the commit header is invalid.
 */
const validateParsedData = (parsedData: CommitHeader): void => {
  const missing = [];
  if (parsedData.tree === '') {
    missing.push('tree');
  }
  if (isBlankPersonLine(parsedData.author)) {
    missing.push('author');
  }
  if (isBlankPersonLine(parsedData.committer)) {
    missing.push('committer');
  }
  if (missing.length > 0) {
    throw new Error(`Invalid commit data: Missing ${missing.join(', ')}`);
  }
};

/**
 * Checks if a person line is blank.
 * @param {PersonLine} personLine - The person line to check.
 * @return {boolean} True if the person line is blank, false otherwise.
 */
const isBlankPersonLine = (personLine: PersonLine): boolean => {
  return personLine.name === '' && personLine.email === '' && personLine.timestamp === '';
};

/**
 * Parses the commit data from the contents of a pack file.
 *
 * Filters out all objects except for commits.
 * @param {CommitContent[]} contents - The contents of the pack file.
 * @return {CommitData[]} An array of commit data objects.
 * @see https://git-scm.com/docs/pack-format#_object_types
 */
const getCommitData = (contents: CommitContent[]): CommitData[] => {
  return lod
    .chain(contents)
    .filter({ type: GIT_OBJECT_TYPE_COMMIT })
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
      const message = allLines
        .slice(headerEndIndex + 1)
        .join('\n')
        .trim();
      console.log({ headerLines, message });

      const { tree, parents, author, committer } = getParsedData(headerLines);
      // No parent headers -> zero hash
      const parent = parents.length > 0 ? parents[0] : EMPTY_COMMIT_HASH;

      return {
        tree,
        parent,
        author: author.name,
        committer: committer.name,
        commitTimestamp: committer.timestamp,
        message,
        authorEmail: author.email,
        committerEmail: committer.email,
      };
    })
    .value();
};

/**
 * Gets the metadata from a pack file.
 * @param {Buffer} buffer - The buffer containing the pack file data.
 * @return {[PackMeta, Buffer]} A tuple containing the metadata and the remaining buffer.
 */
const getPackMeta = (buffer: Buffer): [PackMeta, Buffer] => {
  const sig = buffer.subarray(0, 4).toString('utf-8');
  const version = buffer.readUInt32BE(4);
  const entries = buffer.readUInt32BE(8);

  const meta: PackMeta = {
    sig,
    version,
    entries,
  };

  return [meta, buffer.subarray(12)];
};

/**
 * Gets the contents of a pack file.
 * @param {Buffer} buffer The buffer containing the pack file data.
 * @param {number} numEntries The expected number of entries in the pack file.
 * @return {CommitContent[]}
 */
const getContents = async (buffer: Buffer, numEntries: number): Promise<CommitContent[]> => {
  console.log(
    `getContents parsing buffer length ${buffer.length} and expecting ${numEntries} entries`,
  );
  const entries: CommitContent[] = [];

  const gitObjects = await decompressGitObjects(buffer);
  for (let index = 0; index < gitObjects.length; index++) {
    const obj = gitObjects[index];

    entries.push({
      item: index,
      type: obj.header.type,
      typeName: obj.header.typeName,
      content: obj.data,
      size: obj.header.size,
      baseSha: obj.header.baseSha ? obj.header.baseSha.toString('hex') : null,
      baseOffset: obj.header.baseOffset ? obj.header.baseOffset : null,
    });
  }

  if (numEntries != entries.length) {
    console.warn(
      `getContents returned an unexpected number of entries: ${entries.length}, expected ${numEntries}, entries:\n${JSON.stringify(entries, null, 2)}`,
    );
  } else {
    console.log(`getContents returned ${numEntries} entries:\n${JSON.stringify(entries, null, 2)}`);
  }

  return entries;
};

/**
 * Interface representing an object extracted from a PACK file.
 */
interface GitObject {
  header: GitObjectHeader;
  data: string;
  offset: number;
}

/**
 * Interface representing data parsed from the header of an object in a PACK file.
 */
interface GitObjectHeader {
  type: number; // 1-based Git type number
  typeName: string; // Mapped name
  size: number;
  headerLength: number;
  baseOffset?: number;
  baseSha?: Buffer;
}

/**
 * Maps Git object type codes to human-readable names.
 * @param {number} typeCode  Numeric type code from PACK file.
 * @return {string} Git object type as string.
 */
const gitObjectType = (typeCode: number): string => {
  switch (typeCode) {
    case 1:
      return 'commit';
    case 2:
      return 'tree';
    case 3:
      return 'blob';
    case 4:
      return 'tag';
    case 6:
      return 'ofs_delta';
    case 7:
      return 'ref_delta';
    default:
      return 'unknown';
  }
};

/**
 * Parses an encoded OFS_DELTA offset value.
 * @param {Buffer} buffer The buffer to parse a header from.
 * @param {number} offset The offset within the buffer to begin parsing at.
 * @return { {baseOffset: number, length: number} } The value parsed and its length in bytes.
 */
const parseOfsDeltaOffset = (
  buffer: Buffer,
  offset: number,
): { baseOffset: number; length: number } => {
  let ofs = 0;
  let i = 0;

  do {
    const byte = buffer[offset + i];
    ofs = (ofs << 7) + (byte & 0x7f);
    i++;
  } while (buffer[offset + i - 1] & 0x80);

  return { baseOffset: ofs, length: i };
};

/**
 * Parses the full Git object header including delta metadata.
 * @param {Buffer} buffer The buffer to parse a header from.
 * @param {number} offset The offset within the buffer to begin parsing at.
 * @return {GitObjectHeader} An object containing the data parsed from the
 * header including its length in bytes
 */
const parseGitObjectHeader = (buffer: Buffer, offset: number): GitObjectHeader => {
  const initialOffset = offset;

  let byte = buffer[offset++];

  const type = (byte >> 4) & 0x07;
  let size = byte & 0x0f;
  let shift = 4;

  while (byte & 0x80) {
    byte = buffer[offset++];
    size |= (byte & 0x7f) << shift;
    shift += 7;
  }

  const typeName = gitObjectType(type);
  let baseOffset: number | undefined;
  let baseSha: Buffer | undefined;

  if (typeName === 'ofs_delta') {
    const delta = parseOfsDeltaOffset(buffer, offset);
    baseOffset = delta.baseOffset;
    offset += delta.length;
  } else if (typeName === 'ref_delta') {
    baseSha = buffer.subarray(offset, offset + 20);
    offset += 20;
  }

  const header: GitObjectHeader = {
    type,
    typeName,
    size: size,
    headerLength: offset - initialOffset,
    baseSha,
    baseOffset,
  };
  console.log(`Parsed header: ${JSON.stringify(header)}`);
  return header;
};

/**
 * Decompresses the stream of headers and deflated git objects that follow
 * the 12-byte PACK file headers (which should already have been removed from
 * the buffer before processing it with this function).
 * @param {Buffer} buffer The buffer to decompress
 * @return {Promise<GitObject[]>} A promise to return an array of GitObjects
 * representing the decompressed data.
 */
const decompressGitObjects = async (buffer: Buffer): Promise<GitObject[]> => {
  const results: GitObject[] = [];
  let offset = 0;
  let decompressionError = false;
  let currentWriteResolve: () => void | undefined;

  console.log(`decompressing buffer length ${buffer.length}`);

  // keep going while there is more buffer to consume
  // the buffer will end with either a 20 or 32 byte checksum - we don't know which
  // but we can assume that 12 bytes will not be enough for a final object so there's
  // no point continuing if we have < 32 bytes remaining.
  // TODO: figure how many bytes we finish up with and then validate with the appropriate SHA type
  while (offset < buffer.length - 32 && !decompressionError) {
    const startOffset = offset;
    const header = parseGitObjectHeader(buffer, offset);
    offset += header.headerLength;

    // create a new inflater for each object
    const inflater = createInflate();
    const chunks: Buffer[] = [];
    let done = false;
    let totalLength = 0;

    // store any data returned
    const onData = (data: Buffer) => {
      chunks.push(data);
      totalLength += data.length;
    };

    // stop at the end of each stream - there is no other good way to know how many bytes to process
    const onEnd = () => {
      inflater.end();
      done = true;
      console.log(`end event from inflater, total decompressed ${totalLength}`);
    };

    // stop on errors, except maybe buffer errors?
    const onError = (e: any) => {
      console.log(`Error during inflation: ${JSON.stringify(e)}`);
      inflater.end();
      done = true;
      decompressionError = true;
      if (currentWriteResolve) currentWriteResolve();
    };

    inflater.on('data', onData);
    inflater.on('end', onEnd);
    inflater.on('error', onError);

    // Feed the buffer in a byte at a time and wait for output
    while (offset < buffer.length && !(done || decompressionError)) {
      try {
        await new Promise<void>((resolve, reject) => {
          if (!done) {
            const byte = buffer.subarray(offset, offset + 1);
            offset++;
            // store the resolve function in case an error occurs as callback will never be called
            currentWriteResolve = resolve;
            // use the callback to throttle input such that each byte is processed before we insert the next
            inflater.write(byte, () => {
              resolve();
            });
          } else {
            console.log('tried to write to inflater while done == true');
          }
        });
      } catch (e) {
        console.log(`Error during decompression: ${JSON.stringify(e)}`);
      }
    }
    const result = {
      header,
      data: Buffer.concat(chunks).toString('utf-8'),
      offset: startOffset,
    };

    results.push(result);

    // we overshoot by one byte, back-up 1 to account for it.
    offset--;

    console.log(
      `Finished reading entry ${results.length} at offsets: ${startOffset} - ${offset}: ${JSON.stringify(result.data)}`,
    );

    inflater.off('data', onData);
    inflater.off('end', onEnd);
    inflater.off('error', onError);
    inflater.destroy();
  }
  return results;
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
};

exec.displayName = 'parsePush.exec';

export { exec, getCommitData, getContents, getPackMeta, parsePacketLines };
