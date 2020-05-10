const zlib = require('zlib');
const fs = require('fs');
const BitMask = require('bit-mask');
const dir = './.tmp/';


if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}


const exec = (req, result) => {
  // TODO - this needs a good refactoring!
  // But for the time being - it's working for POC
  // purporses - turns out Streams and node are not nice

  const messageParts = req.rawBody.split(' ');
  result.commit = messageParts[0].substr(4);
  result.commit2 = messageParts[1];
  result.branch = messageParts[2];
  result.headers = req.headers;

  fs.writeFileSync(`${dir}/${result.timestamp}.raw`, req.body);

  const index = req.body.lastIndexOf('PACK');
  const buf = req.body.slice(index);

  const [meta, contentBuff] = getPackMeta(result, buf);

  const contents = getContents(result, contentBuff, meta.entries);

  // Get the meta data
  result.pack = {
    meta: meta,
    contents: contents,
  };

  result.ok = true;
  return result;
};

const getPackMeta = (result, buffer) => {
  fs.writeFileSync(`${dir}/${result.timestamp}.PACK.raw`, buffer);
  const sig = buffer.slice(0, 4).toString('utf-8');
  const version = buffer.readUIntBE(4, 4);
  const entries = buffer.readUIntBE(8, 4);

  const meta = {
    sig: sig,
    version: version,
    entries: entries,
  };

  console.debug(`sig=${sig} version=${version} content=${entries}`);

  return [meta, buffer.slice(12)];
};

const getContents = (meta, buffer, entries) => {
  const contents = [];

  for (let i = 0; i < entries; i++) {
    try {
      const [content, nextBuffer] = getContent(meta, i, buffer);
      buffer = nextBuffer;
      contents.push(content);
    } catch (e) {
      console.log(e);
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

const getContent = (meta, item, buffer) => {
  // FIRST byte contains the type and some of the size of the file
  // a MORE flag -8th byte tells us if there is a subsequent byte
  // which holds the file size

  const byte = buffer.readUIntBE(0, 1);
  console.log(`BYTE=${byte}`);
  const m = new BitMask(byte);

  let more = m.getBit(3);
  let size = [m.getBit(7), m.getBit(8), m.getBit(9), m.getBit(10)];
  const type = getInt([m.getBit(4), m.getBit(5), m.getBit(6)]);

  // Object IDs if this is a deltatfied blob
  let objectRef = null;

  console.log(`type=${type}, more=${more}, size=${size}`);

  // If we have a more flag get the next
  // 8 bytes
  while (more) {
    buffer = buffer.slice(1);
    const byte = buffer.readUIntBE(0, 1);
    console.log(`byte=${byte}`);
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
    console.log(`type=${type}, more=${more}, size=${getInt(size)}`);
  }

  // NOTE Size is the unziped size, not the zipped size
  size = getInt(size);

  console.log(`size=${size}`);

  // Deltafied objectives have a 20 byte identifer
  if (type == 7 || type == 6) {
    objectRef = buffer.slice(0, 20).toString('hex');
    buffer = buffer.slice(20);
    console.log(`object ref = ${objectRef}`);
  }

  contentBuffer = buffer.slice(1);
  const [content, deflatedSize] = unpack(meta, item, contentBuffer);

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


const unpack = (meta, item, buf) => {
  fs.writeFileSync(`${dir}/${meta.timestamp}.PACK.raw.content.{${item}}`, buf);

  // Unzip the content
  const inflated = zlib.inflateSync(buf);

  // We don't have IDX files here, so we need to know how
  // big the zipped content was, to set the next read location
  const deflated = zlib.deflateSync(inflated);

  console.log(`inflated length=${inflated.length}`);

  fs.writeFileSync(
      `${dir}/${meta.timestamp}.PACK.raw.content.{${item}}.deflated`, deflated);

  return [inflated.toString('utf8'), deflated.length];
};

exports.exec = exec;
exports.getPackMeta = getPackMeta;
exports.unpack = unpack;
