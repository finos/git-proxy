/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.    
 */
import { Action, Step } from '../../actions';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import lod from 'lodash';
import { CommitContent } from '../types';
const BitMask = require('bit-mask') as any;

const dir = path.resolve(__dirname, './.tmp');

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

async function exec(req: any, action: Action): Promise<Action> {
  const step = new Step('parsePackFile');

  try {
    if (!req.body || req.body.length === 0) {
      throw new Error('No body found in request');
    }
    const messageParts = req.body.toString('utf8').split(' ');

    action.branch = messageParts[2].trim().replace('\u0000', '');
    action.setCommit(messageParts[0].substr(4), messageParts[1]);

    const index = req.body.lastIndexOf('PACK');
    const buf = req.body.slice(index);
    const [meta, contentBuff] = getPackMeta(buf);
    const contents = getContents(contentBuff as any, meta.entries as number);

    action.commitData = getCommitData(contents as any);

    if (action.commitFrom === '0000000000000000000000000000000000000000') {
      action.commitFrom = action.commitData[action.commitData.length - 1].parent;
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

const getCommitData = (contents: CommitContent[]) => {
  console.log({ contents });
  return lod
    .chain(contents)
    .filter({ type: 1 })
    .map((x) => {
      console.log({ x });

      const formattedContent = x.content.split('\n');
      console.log({ formattedContent });

      const parts = formattedContent.filter((part) => part.length > 0);
      console.log({ parts });

      if (!parts || parts.length < 5) {
        throw new Error('Invalid commit data');
      }

      const tree = parts
        .find((t) => t.split(' ')[0] === 'tree')
        ?.replace('tree', '')
        .trim();
      console.log({ tree });

      const parentValue = parts.find((t) => t.split(' ')[0] === 'parent');
      console.log({ parentValue });

      const parent = parentValue
        ? parentValue.replace('parent', '').trim()
        : '0000000000000000000000000000000000000000';
      console.log({ parent });

      const author = parts
        .find((t) => t.split(' ')[0] === 'author')
        ?.replace('author', '')
        .trim();
      console.log({ author });

      const committer = parts
        .find((t) => t.split(' ')[0] === 'committer')
        ?.replace('committer', '')
        .trim();
      console.log({ committer });

      const indexOfMessages = formattedContent.indexOf('');
      console.log({ indexOfMessages });

      const message = formattedContent
        .slice(indexOfMessages + 1, formattedContent.length - 1)
        .join(' ');
      console.log({ message });

      const commitTimestamp = committer?.split(' ').reverse()[1];
      console.log({ commitTimestamp });

      const authorEmail = author?.split(' ').reverse()[2].slice(1, -1);
      console.log({ authorEmail });

      console.log({
        tree,
        parent,
        author: author?.split('<')[0].trim(),
        committer: committer?.split('<')[0].trim(),
        commitTimestamp,
        message,
        authorEmail,
      });

      if (!tree || !parent || !author || !committer || !commitTimestamp || !message || !authorEmail) {
        throw new Error('Invalid commit data');
      }

      return {
        tree,
        parent,
        author: author.split('<')[0].trim(),
        committer: committer.split('<')[0].trim(),
        commitTimestamp,
        message,
        authorEmail: authorEmail,
      };
    })
    .value();
};

const getPackMeta = (buffer: Buffer) => {
  const sig = buffer.slice(0, 4).toString('utf-8');
  const version = buffer.readUIntBE(4, 4);
  const entries = buffer.readUIntBE(8, 4);

  const meta = {
    sig: sig,
    version: version,
    entries: entries,
  };

  return [meta, buffer.slice(12)];
};

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

const getInt = (bits: boolean[]) => {
  let strBits = '';

  // eslint-disable-next-line guard-for-in
  for (const i in bits) {
    strBits += bits[i] ? 1 : 0;
  }

  return parseInt(strBits, 2);
};

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

const unpack = (buf: Buffer) => {
  // Unzip the content
  const inflated = zlib.inflateSync(buf);

  // We don't have IDX files here, so we need to know how
  // big the zipped content was, to set the next read location
  const deflated = zlib.deflateSync(inflated);

  return [inflated.toString('utf8'), deflated.length];
};

exec.displayName = 'parsePush.exec';

export {
  exec,
  getPackMeta,
  unpack
};
