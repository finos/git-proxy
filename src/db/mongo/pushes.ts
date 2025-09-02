import { connect, findDocuments, findOneDocument } from './helper';
import { Action } from '../../proxy/actions';
import { toClass } from '../helper';
import { PushQuery } from '../types';

const collectionName = 'pushes';

const defaultPushQuery: PushQuery = {
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
};

export const getPushes = async (query: PushQuery = defaultPushQuery): Promise<Action[]> => {
  return findDocuments<Action>(collectionName, query, {
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
    },
  });
};

export const getPush = async (id: string): Promise<Action | null> => {
  const doc = await findOneDocument<any>(collectionName, { id });
  return doc ? (toClass(doc, Action.prototype) as Action) : null;
};

export const deletePush = async function (id: string): Promise<void> {
  const collection = await connect(collectionName);
  await collection.deleteOne({ id });
};

export const writeAudit = async (action: Action): Promise<void> => {
  const data = JSON.parse(JSON.stringify(action));
  const options = { upsert: true };
  const collection = await connect(collectionName);
  delete data._id;
  if (typeof data.id !== 'string') {
    throw new Error('Invalid id');
  }
  await collection.updateOne({ id: data.id }, { $set: data }, options);
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
  return { message: `canceled ${id}` };
};
