const fs = require('fs');
const _ = require('lodash');
const Datastore = require('nedb');
const Action = require('../../proxy/actions').Action;
const toClass = require('./helper').toClass;

if (!fs.existsSync('./.data')) fs.mkdirSync('./.data')
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db')

const db = new Datastore({ filename: './.data/db/pushes.db', autoload: true });


const getPushes = (query={ error: false, blocked: true, allowPush: false, authorised: false }) => {
  return new Promise((resolve, reject) => {
    console.log(`data.file:getPushes`);
    db.find(query, (err, docs) => {
      if (err)
        reject(err);
      else 
        resolve(
          _.chain(docs)
          .map((x) => toClass(x, Action.prototype))
          .value()
        )
    });        
  });
}

const getPush = async (id) => {
  return new Promise((resolve, reject) => {
    console.log(`data.file:getPush(${id})`);
    db.findOne({id: id}, (err, doc) => {
      if (err)
        reject(err);
      else 
        if (!doc) 
          resolve(null);
        else 
          resolve(toClass(doc, Action.prototype));
    });
  });
}
  

const writeAudit = async (action) => {
  return new Promise((resolve, reject) => {
    console.log(`data.file:writeAudit(${action.id})`);
    var options = { multi: false, upsert: true };  
    db.update({id: action.id}, action, options, (err) => {
      if (err)
        reject(err)
      else
        resolve(null);
    });
  });
}

const authorise = async(id) => {
  console.log(`data::authorizing ${id}`)
  const action = await getPush(id);
  action.authorised = true;
  action.canceled = false;
  action.rejected = false;  
  await writeAudit(action);
  return { message: `authorised ${id}`};
}

const reject = async(id) => {
  console.log(`data::reject ${id}`)
  const action = await getPush(id);
  action.authorised = false;
  action.canceled = false;
  action.rejected = true;
  await writeAudit(action);
  return { message: `reject ${id}`};
}

const cancel = async(id) => {
  console.log(`data::cancel ${id}`)
  const action = await getPush(id);  
  action.authorised = false;
  action.canceled = true;
  action.rejected = false;
  await writeAudit(action);
  return { message: `cancel ${id}`};
}

module.exports.getPushes = getPushes;
module.exports.writeAudit = writeAudit;
module.exports.getPush = getPush;
module.exports.authorise = authorise;
module.exports.reject = reject;
module.exports.cancel = cancel;
