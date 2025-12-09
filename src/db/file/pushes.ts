import _ from 'lodash';
import Datastore from '@seald-io/nedb';
import { Action } from '../../proxy/actions/Action';
import { toClass } from '../helper';
import { PushQuery } from '../types';
import { initializeFolders } from './helper';

const COMPACTION_INTERVAL = 1000 * 60 * 60 * 24; // once per day

// these don't get coverage in tests as they have already been run once before the test
/* istanbul ignore if */

// export for testing purposes
export let db: Datastore;
if (process.env.NODE_ENV === 'test') {
  db = new Datastore({ inMemoryOnly: true, autoload: true });
} else {
  db = new Datastore({ filename: './.data/db/pushes.db', autoload: true });
}
try {
  db.ensureIndex({ fieldName: 'id', unique: true });
} catch (e) {
  console.error(
    'Failed to build a unique index of push id values. Please check your database file for duplicate entries or delete the duplicate through the UI and restart. ',
    e,
  );
}
db.setAutocompactionInterval(COMPACTION_INTERVAL);

const defaultPushQuery: Partial<PushQuery> = {
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
  type: 'push',
};

export const getPushes = (query: Partial<PushQuery>): Promise<Action[]> => {
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

export const getPush = async (id: string): Promise<Action | null> => {
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

export const deletePush = async (id: string): Promise<void> => {
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

export const writeAudit = async (action: Action): Promise<void> => {
  return new Promise((resolve, reject) => {
    const options = { multi: false, upsert: true };
    db.update({ id: action.id }, action, options, (err) => {
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

export const authorise = async (id: string, attestation: any): Promise<{ message: string }> => {
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

export const reject = async (id: string, attestation: any): Promise<{ message: string }> => {
  const action = await getPush(id);
  if (!action) {
    throw new Error(`push ${id} not found`);
  }

  action.authorised = false;
  action.canceled = false;
  action.rejected = true;
  action.attestation = attestation;
  await writeAudit(action);
  return { message: `reject ${id}` };
};

export const cancel = async (id: string): Promise<{ message: string }> => {
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
