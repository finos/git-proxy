import fs from 'fs';
import _ from 'lodash';
import Datastore from '@seald-io/nedb';
import { Action } from '../../proxy/actions/Action';
import { toClass } from '../helper';
import { PushQuery } from '../types';

const COMPACTION_INTERVAL = 1000 * 60 * 60 * 24; // once per day

// these don't get coverage in tests as they have already been run once before the test
/* istanbul ignore if */
if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
/* istanbul ignore if */
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

const db = new Datastore({ filename: './.data/db/pushes.db', autoload: true });
db.ensureIndex({ fieldName: 'id', unique: true });
db.setAutocompactionInterval(COMPACTION_INTERVAL);

const defaultPushQuery: PushQuery = {
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
};

export const getPushes = (query: PushQuery) => {
  if (!query) query = defaultPushQuery;
  return new Promise((resolve, reject) => {
    db.find(query, (err: Error, docs: Action[]) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve(
          _.chain(docs)
            .map((x) => toClass(x, Action.prototype))
            .value(),
        );
      }
    });
  });
};

export const getPush = async (id: string) => {
  return new Promise<Action | null>((resolve, reject) => {
    db.findOne({ id: id }, (err, doc) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
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

export const deletePush = async (id: string) => {
  return new Promise<void>((resolve, reject) => {
    db.remove({ id }, (err) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

export const writeAudit = async (action: Action) => {
  return new Promise((resolve, reject) => {
    const options = { multi: false, upsert: true };
    db.update({ id: action.id }, action, options, (err) => {
      // ignore for code coverage as neDB rarely returns errors even for an invalid query
      /* istanbul ignore if */
      if (err) {
        reject(err);
      } else {
        resolve(null);
      }
    });
  });
};

export const authorise = async (id: string, attestation: any) => {
  const action = await getPush(id);
  if (!action) {
    throw new Error(`push ${id} not found`);
  }

  action.authorised = true;
  action.canceled = false;
  action.rejected = false;
  action.attestation = attestation;
  await writeAudit(action);
  return { message: `authorised ${id}` };
};

export const reject = async (id: string) => {
  const action = await getPush(id);
  if (!action) {
    throw new Error(`push ${id} not found`);
  }

  action.authorised = false;
  action.canceled = false;
  action.rejected = true;
  await writeAudit(action);
  return { message: `reject ${id}` };
};

export const cancel = async (id: string) => {
  const action = await getPush(id);
  if (!action) {
    throw new Error(`push ${id} not found`);
  }
  action.authorised = false;
  action.canceled = true;
  action.rejected = false;
  await writeAudit(action);
  return { message: `cancel ${id}` };
};
