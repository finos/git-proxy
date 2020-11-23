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

const getPushes = async (query=defaultPushQuery, logger=console) => {
  logger.info(`getting pushes for query=${query}`);
  const collection = await connect(cnName);
  const results = await collection.find(query).toArray();
  return results;
};

const getPush = async (id, logger=console) => {
  logger.info(`loading doc ${id}`);
  const collection = await connect(cnName);
  const doc = await collection.findOne({id: id});

  console.log(doc);

  if (doc) {
    const result = toClass(doc, Action.prototype);
    logger.info(`loaded doc ${id}`);
    return result;
  }

  return null;
};

const writeAudit = async (action, logger=console) => {
  const data = JSON.parse(JSON.stringify(action));
  logger.log(`data.file:writeAudit(${data.id})`);
  const options = {upsert: true};
  const collection = await connect(cnName);
  delete data._id;
  await collection.update({id: data.id}, data, options);
  logger.log(`data.file:writeAudit(${data.id}) complete`);
  return action;
};

const authorise = async (id, logger=console) => {
  logger.log(`data::authorizing ${id}`);
  const action = await getPush(id, logger);
  action.authorised = true;
  action.canceled = false;
  action.rejected = false;
  await writeAudit(action);
  return {message: `authorised ${id}`};
};

const reject = async (id, logger=console) => {
  logger.log(`data::reject ${id}`);
  const action = await getPush(id, logger);
  action.authorised = false;
  action.canceled = false;
  action.rejected = true;
  await writeAudit(action);
  return {message: `reject ${id}`};
};

const cancel = async (id, logger=console) => {
  logger.log(`data::cancel ${id}`);
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
