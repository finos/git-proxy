import { Action, Step } from '../../actions';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { CommitContent } from '../types';
import { CommitData, TagData } from '../../actions/Action';
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
    console.log('messageParts', messageParts);

    const refName = messageParts[2].replace('\u0000', '').trim();
    const isTag = refName.startsWith('refs/tags/');
    const isBranch = refName.startsWith('refs/heads/');

    action.branch = isBranch ? refName : undefined;
    action.tag = isTag ? refName : undefined;
    action.setCommit(messageParts[0].substr(4), messageParts[1]);

    const index = req.body.lastIndexOf('PACK');
    const buf = req.body.slice(index);
    const [meta, contentBuff] = getPackMeta(buf);
    const contents = getContents(contentBuff as any, meta.entries as number);

    const ParsedObjects = {
      commits: [] as CommitData[],
      tags: [] as TagData[],
    };

    for (const obj of contents) {
      if (obj.type === 1) ParsedObjects.commits.push(parseCommit(obj));
      else if (obj.type === 4) ParsedObjects.tags.push(parseTag(obj));
    }

    action.commitData = ParsedObjects.commits;
    action.tagData = ParsedObjects.tags;

    if (action.commitData.length) {
      if (action.commitFrom === '0000000000000000000000000000000000000000') {
        action.commitFrom = action.commitData[action.commitData.length - 1].parent;
      }
      action.user = action.commitData.at(-1)!.committer;
    } else if (action.tagData?.length) {
      action.user = action.tagData.at(-1)!.tagger;
    } else {
      throw new Error('No commit or tag data parsed from packfile');
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

function parseCommit(x: CommitContent): CommitData {
  console.log({ x });
  const lines = x.content.split('\n');
  console.log({ lines });

  const parts = lines.filter((part) => part.length > 0);
  console.log({ parts });

  if (!parts || parts.length < 5) {
    throw new Error('Invalid commit data');
  }

  const tree = parts
    .find((t) => t.split(' ')[0] === 'tree')
    ?.replace('tree', '')
    .trim();
  console.log({ tree });
  const parent =
    lines
      .find((l) => l.startsWith('parent '))
      ?.slice(7)
      .trim() ?? '0000000000000000000000000000000000000000';
  console.log({ parent });
  const authorLine = lines
    .find((l) => l.startsWith('author '))
    ?.slice(7)
    .trim();
  console.log({ authorLine });
  const committerLine = lines
    .find((l) => l.startsWith('committer '))
    ?.slice(10)
    .trim();
  console.log({ committerLine });
  const msgIndex = lines.indexOf('');
  const message = lines
    .slice(msgIndex + 1)
    .join(' ')
    .trim();
  console.log({ message });
  console.log({ message });

  const commitTimestamp = committerLine?.split(' ').reverse()[1];
  console.log({ commitTimestamp });
  const authorEmail = authorLine?.split(' ').reverse()[2].slice(1, -1);
  console.log({ authorEmail });

  console.log({
    tree,
    parent,
    authorLine: authorLine?.split('<')[0].trim(),
    committerLine: committerLine?.split('<')[0].trim(),
    commitTimestamp,
    message,
    authorEmail,
  });
  if (
    !tree ||
    !parent ||
    !authorLine ||
    !committerLine ||
    !commitTimestamp ||
    !message ||
    !authorEmail
  ) {
    throw new Error('Invalid commit data');
  }

  return {
    tree,
    parent,
    author: authorLine.split('<')[0].trim(),
    committer: committerLine.split('<')[0].trim(),
    commitTimestamp,
    message,
    authorEmail,
  };
}

function parseTag(x: CommitContent): TagData {
  const lines = x.content.split('\n');
  const object = lines
    .find((l) => l.startsWith('object '))
    ?.slice(7)
    .trim();
  const typeLine = lines
    .find((l) => l.startsWith('type '))
    ?.slice(5)
    .trim(); // commit | tree | blob
  const tagName = lines
    .find((l) => l.startsWith('tag '))
    ?.slice(4)
    .trim();
  const rawTagger = lines
    .find((l) => l.startsWith('tagger '))
    ?.slice(7)
    .trim();
  if (!rawTagger) throw new Error('Invalid tag object: no tagger line');

  const taggerName = rawTagger.split('<')[0].trim();

  const messageIndex = lines.indexOf('');
  const message = lines.slice(messageIndex + 1).join('\n');

  if (!object || !typeLine || !tagName || !taggerName) throw new Error('Invalid tag object');

  return {
    object,
    type: typeLine,
    tagName,
    tagger: taggerName,
    message,
  };
}

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

const getContents = (buffer: Buffer, entries: number): CommitContent[] => {
  const contents: CommitContent[] = [];

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

const getContent = (item: number, buffer: Buffer): [CommitContent, Buffer] => {
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
  const result: CommitContent = {
    item,
    value: byte,
    type,
    size: intSize,
    deflatedSize: deflatedSize as number,
    objectRef,
    content: content as string,
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

export { exec, getPackMeta, unpack };
