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
import { gunzipSync, inflateSync } from 'zlib';

import { Action, Step, PullType } from '../../actions';
import { PACKET_SIZE } from '../../constants';
import { PullData } from '../../../types/models';
import { getErrorMessage } from '../../../utils/errors';

type Pkt = { kind: 'data'; line: string } | { kind: 'flush' | 'delim' | 'end' };

/**
 * Tokenizes a pkt-line stream into typed packets (Pkt[]).
 *
 * Unlike parsePacketLines in parsePush this can parse protocol v2 special packets
 * @param {Buffer} buffer The pkt-line encoded buffer.
 * @return {Pkt[]} The parsed packets.
 */
export const tokenizePktLines = (buffer: Buffer): Pkt[] => {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('tokenizePktLines expected a Buffer');
  }
  const pkts: Pkt[] = [];
  let offset = 0;

  while (offset + PACKET_SIZE <= buffer.length) {
    const lengthHex = buffer.toString('utf8', offset, offset + PACKET_SIZE);
    const length = /^[0-9a-fA-F]{4}$/.test(lengthHex) ? parseInt(lengthHex, 16) : NaN;

    if (Number.isNaN(length) || length === 3 || offset + length > buffer.length) {
      throw new Error(`Invalid packet line length ${lengthHex} at offset ${offset}`);
    }

    if (length < PACKET_SIZE) {
      pkts.push({ kind: (['flush', 'delim', 'end'] as const)[length] });
      offset += PACKET_SIZE;
      continue;
    }

    const line = buffer.toString('utf8', offset + PACKET_SIZE, offset + length).replace(/\n$/, '');
    pkts.push({ kind: 'data', line });
    offset += length;
  }

  return pkts;
};

const emptyPullData = (protocolVersion: 1 | 2, command: PullType): PullData => ({
  protocolVersion,
  command,
  capabilities: [],
  wants: [],
  haves: [],
  wantRefs: [],
  refPrefixes: [],
  shallow: [],
  done: false,
  options: [],
});

/**
 * Applies a single fetch / ls-refs argument line to the request data.
 *
 * @param {PullData} data The data being built.
 * @param {string} line The argument line without trailing newline
 * @return {string[]} Any trailing tokens after the value (v1 capabilities)
 */
const applyArgument = (data: PullData, line: string): string[] => {
  const [key, ...rest] = line.split(' ');
  const value = rest[0];

  switch (key) {
    case 'want':
      data.wants.push(value);
      return rest.slice(1);
    case 'have':
      data.haves.push(value);
      break;
    case 'want-ref':
      data.wantRefs.push(value);
      break;
    case 'ref-prefix':
      data.refPrefixes.push(value);
      break;
    case 'shallow':
      data.shallow.push(value);
      break;
    case 'deepen':
    case 'deepen-since':
    case 'deepen-not':
      data.deepen = line;
      break;
    case 'filter':
      data.filter = rest.join(' ');
      break;
    case 'done':
      data.done = true;
      break;
    default:
      data.options.push(line);
  }
  return [];
};

/**
 * Parses a protocol v0/v1 upload-pack requestin the form:
 *   want <oid> <capabilities>\n
 *   want <oid>\n ...
 *   0000
 *   have <oid>\n ...
 *   done\n
 * @param {Pkt[]} pkts The tokenized packets.
 * @return {PullData} The parsed request.
 */
const parseV1 = (pkts: Pkt[]): PullData => {
  const data = emptyPullData(1, PullType.FETCH);
  let firstWant = true;

  for (const pkt of pkts) {
    if (pkt.kind !== 'data') continue;
    const trailing = applyArgument(data, pkt.line);
    if (firstWant && pkt.line.startsWith('want ')) {
      data.capabilities = trailing;
      firstWant = false;
    }
  }
  return data;
};

/**
 * Parses a protocol v2 upload-pack request in the form:
 *   command=fetch\n  (or command=ls-refs)
 *   agent=git/2.x\n
 *   object-format=sha1\n
 *   0001
 *   <arguments>
 *   0000
 * @param {Pkt[]} pkts The tokenized packets.
 * @return {PullData} The parsed request.
 */
const parseV2 = (pkts: Pkt[]): PullData => {
  const data = emptyPullData(2, PullType.FETCH);
  let inArguments = false;
  let sawCommand = false;

  for (const pkt of pkts) {
    if (pkt.kind === 'delim') {
      inArguments = true;
      continue;
    }
    if (pkt.kind === 'flush') {
      // A flush ends one command; the git client sends one command per request.
      break;
    }
    if (pkt.kind !== 'data') continue;

    if (!inArguments) {
      if (pkt.line.startsWith('command=')) {
        const command = pkt.line.slice('command='.length);
        if (command !== PullType.FETCH && command !== PullType.LS_REFS) {
          throw new Error(`Unsupported protocol v2 command: ${command}`);
        }
        data.command = command;
        sawCommand = true;
      } else {
        data.capabilities.push(pkt.line);
      }
      continue;
    }

    applyArgument(data, pkt.line);
  }

  if (!sawCommand) {
    throw new Error('Protocol v2 request did not specify a command');
  }
  return data;
};

/**
 * Returns the request body as a plain pkt-line buffer.
 *
 * @param {Request} req The Express request.
 * @return {Buffer} The decoded body.
 */
const decodeBody = (req: Request): Buffer => {
  const body = req.body as unknown;
  if (!body || !Buffer.isBuffer(body) || body.length === 0) {
    throw new Error('Request body must be a non-empty Buffer');
  }

  const isGzip = body.length > 2 && body[0] === 0x1f && body[1] === 0x8b;
  if (isGzip) {
    return gunzipSync(body);
  }
  if (req.headers['content-encoding'] === 'deflate') {
    return inflateSync(body);
  }
  return body;
};

const isProtocolV2 = (req: Request, pkts: Pkt[]): boolean => {
  const header = req.headers['git-protocol'];
  const headerValue = Array.isArray(header) ? header.join(':') : (header ?? '');
  if (headerValue.split(':').includes('version=2')) {
    return true;
  }
  // Fallback: a v2 body always opens with command=<name>
  const first = pkts.find((p) => p.kind === 'data');
  return first?.kind === 'data' && first.line.startsWith('command=');
};

/**
 * Parses an upload-pack (fetch) request and records what the client asked for
 * on the action, for use by plugins/other processors
 * @param {Request} req The Express request containing the upload-pack body.
 * @param {Action} action The action to populate.
 * @return {Promise<Action>} The populated action.
 */
async function exec(req: Request, action: Action): Promise<Action> {
  const step = new Step('parsePull');
  try {
    const body = decodeBody(req);
    const pkts = tokenizePktLines(body);
    const data = isProtocolV2(req, pkts) ? parseV2(pkts) : parseV1(pkts);

    action.pullData = data;
    action.actionType = data.command;

    if (data.command === PullType.FETCH) {
      step.log(
        `Fetch request (protocol v${data.protocolVersion}): ${data.wants.length} want(s), ` +
          `${data.haves.length} have(s), ${data.wantRefs.length} want-ref(s), done=${data.done}`,
      );
    } else {
      step.log(
        `ls-refs request (protocol v${data.protocolVersion}): prefixes=${
          data.refPrefixes.join(', ') || '<all refs>'
        }`,
      );
    }

    step.content = data;
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    step.setError(`Unable to parse pull. Please contact an administrator for support: ${msg}`);
  } finally {
    action.addStep(step);
  }
  return action;
}

exec.displayName = 'parsePull.exec';

export { exec };
