const connect = require('./helper').connect;
const Action = require('../../proxy/actions').Action;
const toClass = require('../helper').toClass;
const repo = require('./repo');
const cnName = 'pushes';

const defaultPushQuery = {
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
};

const getPushes = async (query=defaultPushQuery) => {
  const collection = await connect(cnName);
  const results = await collection.find(
    query, {
      projection: {
        _id: 0,
        id: 1,
        allowPush: 1,
        authorised: 1,
        blocked: 1,
        blockedMessage: 1,
        branch: 1,
        canceled: 1,
        commitData: 1,
        commitFrom: 1,
        commitTo: 1,
        error: 1,
        method: 1,
        project: 1,
        rejected: 1,
        repo: 1,
        repoName: 1,
        timepstamp: 1,
        type: 1,
        url: 1,
    }}).toArray();
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
  const action = await getPush(id);
  action.authorised = true;
  action.canceled = false;
  action.rejected = false;
  await writeAudit(action);
  return {message: `authorised ${id}`};
};

const reject = async (id) => {
  const action = await getPush(id);
  action.authorised = false;
  action.canceled = false;
  action.rejected = true;
  await writeAudit(action);
  return {message: `reject ${id}`};
};

const cancel = async (id) => {
  const action = await getPush(id);
  action.authorised = false;
  action.canceled = true;
  action.rejected = false;
  await writeAudit(action);
  return {message: `canceled ${id}`};
};

const canUserApproveRejectPush = async (id, user) => {
  return new Promise(async (resolve, reject) => {
    const action = await getPush(id);
    const repoName = action.repoName.replace('.git', '');
    const isAllowed = await repo.canUserApproveRejectPushRepo(repoName, user);

    resolve(isAllowed);
  });
};

const canUserCanclePush = async (id, user) => {
  return new Promise(async (resolve, reject) => {
    const pushDetail = await getPush(id);
    const repoName = pushDetail.repoName.replace('.git', '');
    const isAllowed = await repo.isUserPushAllowed(repoName, user);

    if (isAllowed) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

module.exports.getPushes = getPushes;
module.exports.writeAudit = writeAudit;
module.exports.getPush = getPush;
module.exports.authorise = authorise;
module.exports.reject = reject;
module.exports.cancel = cancel;
module.exports.canUserApproveRejectPush = canUserApproveRejectPush;
module.exports.canUserCanclePush = canUserCanclePush;

