/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Request } from 'express';
import fs from 'fs';
import lod from 'lodash';
import { createInflate } from 'zlib';

import { Action, Step } from '../../actions';
import { CommitContent, CommitData, CommitHeader, PackMeta, PersonLine } from '../types';
import {
  BRANCH_PREFIX,
  EMPTY_COMMIT_HASH,
  GIT_OBJECT_ID_REGEX,
  PACK_SIGNATURE,
  PACKET_SIZE,
  GIT_OBJECT_TYPE_COMMIT,
  SEVEN_BIT_MASK,
  EIGHTH_BIT_MASK,
} from '../constants';
import { getErrorMessage } from '../../../utils/errors';
import {
  getMaxDecompressedObjectSizeBytes,
  getMaxDecompressedPackSizeBytes,
  getMaxPackExpansionRatio,
  getMaxPackObjects,
} from '../../../config';
import { Limits } from '../../../config/generated/config';

const dir = './.tmp/';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

// Validates a value is a well-formed Git object ID (40-char lowercase hex).
export const isValidGitObjectId = (oid: string): boolean => {
  return GIT_OBJECT_ID_REGEX.test(oid);
};

/**
 * Executes the parsing of a push request.
 * @param {Request} req - The Express Request object containing the push data.
 * @param {Action} action - The action object to be modified.
 * @return {Promise<Action>} The modified action object.
 */
async function exec(req: Request, action: Action): Promise<Action> {
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
    }

    const [commitParts] = refUpdates[0].split('\0');
    const parts = commitParts.split(' ');
    if (parts.length !== 3) {
      step.log('Invalid number of parts in ref update.');
      step.log(`Expected 3, but got ${parts.length}`);
      throw new Error('Your push has been blocked. Invalid ref update format.');
    }

    const [oldCommit, newCommit, ref] = parts;

    // Reject malformed commit IDs before they are used to build the action id and paths.
    if (!isValidGitObjectId(oldCommit) || !isValidGitObjectId(newCommit)) {
      throw new Error('Your push has been blocked. Invalid commit ID format.');
    }

    // Strip everything after NUL, which is cap-list from
    // https://git-scm.com/docs/http-protocol#_smart_server_response
    action.branch = ref.replace(/\0.*/, '').trim();

    // Note this will change the action.id to be based on the commits
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
    const [meta, contentBuff] = getPackMeta(buf);
    const contents = await getContents(contentBuff, meta.entries);

    action.commitData = getCommitData(contents);

    if (action.commitData.length === 0) {
      step.log('No commit data found when parsing push.');
    } else {
      if (action.commitFrom === EMPTY_COMMIT_HASH) {
        action.commitFrom = action.commitData[action.commitData.length - 1].parent;
      }

      // commitFrom may have been reassigned from PACK data above; re-validate it.
      if (action.commitFrom && !isValidGitObjectId(action.commitFrom)) {
        throw new Error('Your push has been blocked. Invalid commit ID format.');
      }

      const { committer, committerEmail } = action.commitData[action.commitData.length - 1];
      // Note: This is not always the pusher's email, it's the last committer's email.
      // See https://github.com/finos/git-proxy/issues/1400
      step.log(`Push request received from user ${committer} with email ${committerEmail}`);
      action.user = committer;
      action.userEmail = committerEmail;
    }

    step.content = {
      meta: meta,
    };
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    step.setError(`Unable to parse push. Please contact an administrator for support: ${msg}`);
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
 * @param {object} [options] Optional decompression limits (overrides `limits` config).
 * @return {CommitContent[]}
 */
const getContents = async (
  buffer: Buffer,
  numEntries: number,
  options: Partial<Limits> = {},
): Promise<CommitContent[]> => {
  // Expansion ratio is measured against the whole remaining buffer, including padding
  // absolute limit is set to the worst case memory use
  const expansionRatio = options.maxPackExpansionRatio ?? getMaxPackExpansionRatio();
  const maxDecompressedSize =
    options.maxDecompressedPackSizeBytes ??
    Math.min(getMaxDecompressedPackSizeBytes(), buffer.length * expansionRatio);
  const maxObjectDecompressedSize = Math.min(
    options.maxDecompressedObjectSizeBytes ?? getMaxDecompressedObjectSizeBytes(),
    maxDecompressedSize,
  );
  const maxObjects = options.maxPackObjects ?? getMaxPackObjects();

  if (!Number.isSafeInteger(numEntries) || numEntries < 0 || numEntries > maxObjects) {
    throw new Error('PACK object count exceeds the safety limit.');
  }

  const entries: CommitContent[] = [];

  const gitObjects = await decompressGitObjects(
    buffer,
    maxDecompressedSize,
    maxObjectDecompressedSize,
    maxObjects,
  );
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
      `getContents returned an unexpected number of entries: ${entries.length}, expected ${numEntries}, ${summariseEntries(entries)}`,
    );
  } else {
    console.log(`getContents returned ${numEntries} entries, ${summariseEntries(entries)}`);
  }

  return entries;
};

/**
 * Summarises object metadata for logging
 *
 * @param {CommitContent[]} entries The objects extracted from a PACK file
 * @return {string} Human readable summary of the entries
 */
const summariseEntries = (entries: CommitContent[]): string => {
  const countsByType = new Map<string, number>();
  let totalSize = 0;

  for (const entry of entries) {
    countsByType.set(entry.typeName, (countsByType.get(entry.typeName) ?? 0) + 1);
    totalSize += entry.size;
  }

  const byType = [...countsByType].map(([type, count]) => `${type}=${count}`).join(' ');
  return `${totalSize} decompressed bytes (${byType})`;
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

type GitObjectType = 'commit' | 'tree' | 'blob' | 'tag' | 'ofs_delta' | 'ref_delta' | 'unknown';

/**
 * Maps Git object type codes to human-readable names.
 * @param {number} typeCode  Numeric type code from PACK file.
 * @return {GitObjectType} Git object type
 */
const gitObjectType = (typeCode: number): GitObjectType => {
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
  let i = 0;
  let byte = buffer[offset];
  let value = byte & SEVEN_BIT_MASK;

  while (byte & EIGHTH_BIT_MASK) {
    i++;
    byte = buffer[offset + i];
    value = ((value + 1) << 7) | (byte & SEVEN_BIT_MASK);
  }

  return { baseOffset: value, length: i + 1 };
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

  // read object type
  const type = (byte >> 4) & 0x07;
  const typeName = gitObjectType(type);

  // read variable length size of encoded object
  let size = byte & 0x0f;
  let shift = 4;
  while (byte & EIGHTH_BIT_MASK) {
    byte = buffer[offset++];
    size |= (byte & SEVEN_BIT_MASK) << shift;
    shift += 7;
  }

  // read references for ref_delta and ofd_delta types
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
  return header;
};

/**
 * Decompresses the stream of headers and deflated git objects that follow
 * the 12-byte PACK file headers (which should already have been removed from
 * the buffer before processing it with this function).
 * @param {Buffer} buffer The buffer to decompress
 * @param {number} maxDecompressedSize Maximum allowed total decompressed size.
 * @param {number} maxObjectDecompressedSize Maximum allowed decompressed size of a single object.
 * @param {number} maxObjects Maximum allowed object count.
 * @return {Promise<GitObject[]>} A promise to return an array of GitObjects
 * representing the decompressed data.
 */
const decompressGitObjects = async (
  buffer: Buffer,
  maxDecompressedSize: number,
  maxObjectDecompressedSize: number,
  maxObjects: number,
): Promise<GitObject[]> => {
  const results: GitObject[] = [];
  let offset = 0;
  let currentWriteResolve: (() => void) | undefined;
  let error: Error | null = null;
  let declaredDecompressedSize = 0;

  // keep going while there is more buffer to consume
  // the buffer will end with either a 20 or 32 byte checksum - we don't know which
  // but we can assume that 12 bytes will not be enough for a final object so there's
  // no point continuing if we have < 32 bytes remaining.
  // TODO: figure how many bytes we finish up with and then validate with the appropriate SHA type
  while (offset < buffer.length - 32 && !error) {
    if (results.length >= maxObjects) {
      throw new Error('PACK object count exceeds the safety limit.');
    }

    const startOffset = offset;
    const header = parseGitObjectHeader(buffer, offset);
    offset += header.headerLength;

    if (
      !Number.isSafeInteger(header.size) ||
      header.size < 0 ||
      header.size > maxObjectDecompressedSize
    ) {
      throw new Error('PACK object decompressed size exceeds the safety limit.');
    }

    declaredDecompressedSize += header.size;
    if (declaredDecompressedSize > maxDecompressedSize) {
      throw new Error('PACK decompressed size exceeds the safety limit.');
    }

    // create a new inflater for each object; cap output at the declared size
    const inflater = createInflate({ maxOutputLength: Math.max(header.size, 1) });
    const chunks: Buffer[] = [];
    let done = false;
    let actualDecompressedSize = 0;

    // store any data returned
    const onData = (data: Buffer) => {
      actualDecompressedSize += data.length;
      if (actualDecompressedSize > header.size) {
        error = new Error('Inflated PACK object exceeds its declared size.');
        done = true;
        inflater.destroy();
        if (currentWriteResolve) currentWriteResolve();
        return;
      }
      chunks.push(data);
    };

    // stop at the end of each stream - there is no other good way to know how many bytes to process
    const onEnd = () => {
      inflater.end();
      done = true;
    };

    // stop on errors, except maybe buffer errors?
    const onError = (e: unknown) => {
      const msg = getErrorMessage(e);
      console.warn(`Error during inflation: ${msg}`);
      error = new Error(`Error during inflation: ${msg}`);
      inflater.end();
      done = true;
      if (currentWriteResolve) currentWriteResolve();
    };

    inflater.on('data', onData);
    inflater.on('end', onEnd);
    inflater.on('error', onError);

    // Feed the buffer in a byte at a time and wait for output
    while (offset < buffer.length && !(done || error)) {
      try {
        await new Promise<void>((resolve, reject) => {
          if (!done) {
            // store the resolve function in case an error occurs as callback will never be called
            currentWriteResolve = resolve;
            // use the callback to throttle input such that each byte is processed before we insert the next
            inflater.write(buffer.subarray(offset, offset + 1), () => {
              resolve();
            });
            offset++;
          }
        });
      } catch (e: unknown) {
        const msg = getErrorMessage(e);
        console.warn(`Error during decompression: ${msg}`);
        error = new Error(`Error during decompression: ${msg}`);
      }
    }
    if (error) {
      inflater.removeAllListeners();
      inflater.destroy();
      break;
    }
    if (actualDecompressedSize !== header.size) {
      inflater.removeAllListeners();
      inflater.destroy();
      throw new Error('Inflated PACK object does not match its declared size.');
    }
    const result = {
      header,
      data: Buffer.concat(chunks).toString('utf-8'),
      offset: startOffset,
    };

    results.push(result);

    // we overshoot by one byte, back-up 1 to account for it.
    offset--;

    inflater.removeAllListeners();
    inflater.destroy();
  }

  // throw any error that was caught as we were not able to read the pack file in full
  if (error) {
    throw error;
  }
  return results;
};

/** Maximum pkt-lines accepted from a single receive-pack / protocol buffer. */
export const MAX_PACKET_LINES = 100_000;

/**
 * Parses the packet lines from a buffer into an array of strings.
 * Also returns the offset immediately following the parsed lines (including the flush packet).
 * @param {Buffer} buffer - The buffer containing the packet data.
 * @param {number} [maxLines] - Maximum number of pkt-lines to accept.
 * @return {[string[], number]} An array containing the parsed lines and the offset after the last parsed line/flush packet.
 */
const parsePacketLines = (buffer: Buffer, maxLines = MAX_PACKET_LINES): [string[], number] => {
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

    if (lines.length >= maxLines) {
      throw new Error(`Too many packet lines (limit ${maxLines})`);
    }

    const line = buffer.toString('utf8', offset + PACKET_SIZE, offset + length);
    lines.push(line);
    offset += length; // Move offset to the start of the next line's length prefix
  }
  return [lines, offset];
};

exec.displayName = 'parsePush.exec';

export { exec, getCommitData, getContents, getPackMeta, parsePacketLines };
