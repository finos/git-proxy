const fs = require('fs');
const _ = require('lodash');
const Datastore = require('nedb');
const Action = require('../../proxy/actions').Action;
const toClass = require('./helper').toClass;

if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

const db = new Datastore({filename: './.data/db/pushes.db', autoload: true});

const defaultPushQuery = {
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
};

const getPushes = (query=defaultPushQuery, logger=console) => {
  return new Promise((resolve, reject) => {
    logger.log(`data.file:getPushes`);
    db.find(query, (err, docs) => {
      if (err) {
        reject(err);
      } else {
        resolve(
            _.chain(docs).map((x) => toClass(x, Action.prototype)).value(),
        );
      }
    });
  });
};

const getPush = async (id, logger=console) => {
  return new Promise((resolve, reject) => {
    logger.log(`data.file:getPush(${id})`);
    db.findOne({id: id}, (err, doc) => {
      if (err) {
        reject(err);
      } else {
        if (!doc) {
          resolve(null);
        } else {
          resolve(toClass(doc, Action.prototype));
        }
      }
    });
  });
};

const writeAudit = async (action, logger=console) => {
  return new Promise((resolve, reject) => {
    logger.log(`data.file:writeAudit(${action.id})`);
    const options = {multi: false, upsert: true};
    db.update({id: action.id}, action, options, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });
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
