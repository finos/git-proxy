const connect = require('./helper').connect;
const Action = require('../../proxy/actions').Action;
const toClass = require('../helper').toClass;
const cnName = 'pushes';

const defaultPushQuery = {
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
};

const getPushes = async (query=defaultPushQuery) => {
  const collection = await connect(cnName);
  const results = await collection.find(query).toArray();
  return results;
};

const getPush = async (id) => {
  const collection = await connect(cnName);
  const doc = await collection.findOne({id: id});

  if (doc) {
    return toClass(doc, Action.prototype);
  }

  return null;
};

const writeAudit = async (action) => {
  const data = JSON.parse(JSON.stringify(action));
  const options = {upsert: true};
  const collection = await connect(cnName);
  delete data._id;
  await collection.updateOne({id: data.id}, {'$set': data}, options);
  return action;
};

const authorise = async (id) => {
  const action = await getPush(id, logger);
  action.authorised = true;
  action.canceled = false;
  action.rejected = false;
  await writeAudit(action);
  return {message: `authorised ${id}`};
};

const reject = async (id) => {
  const action = await getPush(id, logger);
  action.authorised = false;
  action.canceled = false;
  action.rejected = true;
  await writeAudit(action);
  return {message: `reject ${id}`};
};

const cancel = async (id) => {
  const action = await getPush(id, logger);
  action.authorised = false;
  action.canceled = true;
  action.rejected = false;
  await writeAudit(action);
  return {message: `cancel ${id}`};
};

module.exports.getPushes = getPushes;
module.exports.writeAudit = writeAudit;
module.exports.getPush = getPush;
module.exports.authorise = authorise;
module.exports.reject = reject;
module.exports.cancel = cancel;
