const zlib = require('zlib');
const fs = require('fs');
const dir = './.tmp/';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

const exec = (req, result) => {
  const messageParts = req.rawBody.split(' ');
  result.commit = messageParts[0];
  result.commit2 = messageParts[1];
  result.branch = messageParts[2];
  result.headers = req.headers;

  fs.writeFileSync(`${dir}/${result.timestamp}.raw`, req.body);

  const index = req.body.lastIndexOf('PACK');
  const buf = req.body.slice(index);

  // Get the meta data
  result.pack = {
    meta: getPackMeta(buf),
  };

  fs.writeFileSync(`${dir}/${result.timestamp}.PACK.raw`, buf);

  result.ok = false;
  return result;
};

const getPackMeta = (buffer) => {
  const sig = buffer.slice(0, 4).toString('utf-8');
  const version = buffer.slice(4).readUIntBE(0, 4);
  const contents = buffer.slice(8).readUIntBE(0, 4);

  console.debug(`sig=${sig} version=${version} content=${contents}`);

  return {
    sig: sig,
    version: version,
    contents: contents,
  };
};

const unpack = (buf, size) => {
  result.packContent = zlib.inflateSync(pack).toString('utf8');
};

exports.exec = exec;
exports.getPackMeta = getPackMeta;
exports.unpack = unpack;
