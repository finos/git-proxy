const fs = require('fs');
const _ = require('lodash')
const db = require('diskdb');
const Action = require('../../proxy/actions').Action;
const toClass = require('./helper').toClass;

if (!fs.existsSync('./.data')) fs.mkdirSync('./.data')
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db')

db.connect('./.data/db', ['pushes']);

const getPushes = async (query={ error: false, blocked: true, allowPush: false, authorised: false }) => {
  console.log(`data.file:getPushes`);
  const data = await db.pushes.find(query);
  console.log(data);
  return _.chain(data)
    .map((x) => toClass(x, Action.prototype))
    .value();  
}

const getPush = async (id) => {  
  console.log(`data.file:getPush(${id})`);
  const data = await db.pushes.findOne({id: id});
  
  if (data) {
    const action = toClass(data, Action.prototype);
    return action;    
  }
}

const writeAudit = async (action) => {
  console.log(`data.file:writeAudit(${action.id})`);
  var options = { multi: false, upsert: true };  
  await db.pushes.update({id: action.id}, action, options);
}

const authorise = async(id) => {
  console.log(`data::authorizing ${id}`)
  const action = await getPush(id);
  action.authorised = true;
  await writeAudit(action);
  return { message: `authorised ${id}`};
}

const reject = async(id) => {
  console.log(`data::reject ${id}`)
  const action = await getPush(id);
  action.authorised = false;
  action.reject = true;
  await writeAudit(action);
  return { message: `reject ${id}`};
}

const cancel = async(id) => {
  console.log(`data::cancel ${id}`)
  const action = await getPush(id);  
  action.cancel = true;
  await writeAudit(action);
  return { message: `cancel ${id}`};
}

module.exports.getPushes = getPushes;
module.exports.writeAudit = writeAudit;
module.exports.getPush = getPush;
module.exports.authorise = authorise;
module.exports.reject = reject;
module.exports.cancel = cancel;
