const connect = require('./helper').connect;
const cnName = 'pushes';

const getPushes = async (query=defaultPushQuery, logger=console) => {
  const collection = await connect(cnName);
  return await collection.find(query).toArray();
};

const getPush = async (id, logger=console) => {
  const collection = await connect(cnName);
  const doc = await collection.findOne({id: id});
  return toClass(doc, Action.prototype);
};

const writeAudit = async (action, logger=console) => {
  logger.log(`data.file:writeAudit(${action.id})`);
  const options = {upsert: true};
  const collection = await connect(cnName);
  collection.update({id: action.id}, action, options);
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
