const zlib = require('zlib');
const fs = require('fs');
const lod = require('lodash');
const BitMask = require('bit-mask');
const Step = require('../../actions').Step;
const dir = './.tmp/';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

const exec = async (req, action) => {
  const step = new Step('parsePackFile');
  try {
    const messageParts = req.rawBody.split(' ');
    action.branch = messageParts[2].trim().replace('\u0000', '');
    action.setCommit(messageParts[0].substr(4), messageParts[1]);

    const index = req.body.lastIndexOf('PACK');
    const buf = req.body.slice(index);
    const [meta, contentBuff] = getPackMeta(buf);
    const contents = getContents(contentBuff, meta.entries);

    action.commitData = getCommitData(contents);

    if (action.commitFrom === '0000000000000000000000000000000000000000') {
      action.commitFrom = action.commitData[action.commitData.length -1].parent;
    }

    step.content = {
      meta: meta,
    };
  } catch (e) {
    step.setError(e.toString('utf-8'));
    throw e;
  } finally {
    action.addStep(step);
    return action;
  }
};

const getCommitData = (contents) => {
  return lod.chain(contents)
      .filter({'type': 1})
      .map((x) => {
        const parts = x.content.split('\n');
        const tree = parts[0];
        const parent = parts[1];
        const author = parts[2];
        const committer = parts[3];
        const message = parts[5];

        return {
          tree: tree.replace('parent', '').trim(),
          parent: parent.replace('parent', '').trim(),
          author: author.split(' ')[1],
          committer: committer.split(' ')[1],
          commitTs: author.split(' ')[3],
          message: message,
        };
      }).value();
};

const getPackMeta = (buffer) => {
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

const getContents = (buffer, entries) => {
  const contents = [];

  for (let i = 0; i < entries; i++) {
    try {
      const [content, nextBuffer] = getContent(i, buffer);
      buffer = nextBuffer;
      contents.push(content);
    } catch (e) {
    }
  }
  return contents;
};

const getInt = (bits) => {
  let strBits = '';

  // eslint-disable-next-line guard-for-in
  for (i in bits) {
    strBits += bits[i] ? 1 : 0;
  }

  return parseInt(strBits, 2);
};

const getContent = (item, buffer) => {
  // FIRST byte contains the type and some of the size of the file
  // a MORE flag -8th byte tells us if there is a subsequent byte
  // which holds the file size

  const byte = buffer.readUIntBE(0, 1);
  const m = new BitMask(byte);

  let more = m.getBit(3);
  let size = [m.getBit(7), m.getBit(8), m.getBit(9), m.getBit(10)];
  const type = getInt([m.getBit(4), m.getBit(5), m.getBit(6)]);

  // Object IDs if this is a deltatfied blob
  let objectRef = null;


  // If we have a more flag get the next
  // 8 bytes
  while (more) {
    buffer = buffer.slice(1);
    const byte = buffer.readUIntBE(0, 1);
    const m = new BitMask(byte);

    const nextSize = [
      m.getBit(4),
      m.getBit(5),
      m.getBit(6),
      m.getBit(7),
      m.getBit(8),
      m.getBit(9),
      m.getBit(10),
    ];

    size = nextSize.concat(size);
    more = m.getBit(3);
  }

  // NOTE Size is the unziped size, not the zipped size
  size = getInt(size);


  // Deltafied objectives have a 20 byte identifer
  if (type == 7 || type == 6) {
    objectRef = buffer.slice(0, 20).toString('hex');
    buffer = buffer.slice(20);
  }

  contentBuffer = buffer.slice(1);
  const [content, deflatedSize] = unpack(contentBuffer);

  // NOTE Size is the unziped size, not the zipped size
  // so it's kind of useless for us in terms of reading the stream
  const result = {
    item: item,
    value: byte,
    type: type,
    size: size,
    deflatedSize: deflatedSize,
    objectRef: objectRef,
    content: content,
  };

  // Move on by the zipped content size.
  nextBuffer = contentBuffer.slice(deflatedSize);

  return [result, nextBuffer];
};


const unpack = (buf) => {
  // Unzip the content
  const inflated = zlib.inflateSync(buf);

  // We don't have IDX files here, so we need to know how
  // big the zipped content was, to set the next read location
  const deflated = zlib.deflateSync(inflated);

  return [inflated.toString('utf8'), deflated.length];
};

exec.displayName = 'parsePush.exec';
exports.exec = exec;
exports.getPackMeta = getPackMeta;
exports.unpack = unpack;
