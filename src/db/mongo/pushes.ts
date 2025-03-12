import { connect, findDocuments, findOneDocument } from './helper';
import { Action } from '../../proxy/actions';
import { toClass } from '../helper';
import * as repo from './repo';
import { Push, PushQuery } from '../types';

const collectionName = 'pushes';

const defaultPushQuery: PushQuery = {
  error: false,
  blocked: true,
  allowPush: false,
  authorised: false,
};

export const getPushes = async (
  query: PushQuery = defaultPushQuery
): Promise<Push[]> => {
  return findDocuments<Push>(collectionName, query, {
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
  return doc ? toClass(doc, Action.prototype) as Action : null;
};

export const writeAudit = async (action: Action): Promise<Action> => {
  const data = JSON.parse(JSON.stringify(action));
  const options = { upsert: true };
  const collection = await connect(collectionName);
  delete data._id;
  if (typeof data.id !== 'string') {
    throw new Error('Invalid id');
  }
  await collection.updateOne({ id: data.id }, { $set: data }, options);
  return action;
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
  return { message: `canceled ${id}` };
};

export const canUserApproveRejectPush = async (id: string, user: string) => {
  return new Promise(async (resolve) => {
    const action = await getPush(id);
    if (!action) {
      resolve(false);
      return;
    }

    const repoName = action.repoName.replace('.git', '');
    const isAllowed = await repo.canUserApproveRejectPushRepo(repoName, user);

    resolve(isAllowed);
  });
};

export const canUserCancelPush = async (id: string, user: string) => {
  return new Promise(async (resolve) => {
    const pushDetail = await getPush(id);
    if (!pushDetail) {
      resolve(false);
      return;
    }

    const repoName = pushDetail.repoName.replace('.git', '');
    const isAllowed = await repo.isUserPushAllowed(repoName, user);

    if (isAllowed) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
};
