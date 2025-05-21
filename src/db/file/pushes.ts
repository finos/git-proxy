/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.    
 */
import fs from 'fs';
import _ from 'lodash';
import Datastore from '@seald-io/nedb';
import { Action } from '../../proxy/actions/Action';
import { toClass } from '../helper';
import * as repo from './repo';
import { PushQuery } from '../types'

if (!fs.existsSync('./.data')) fs.mkdirSync('./.data');
if (!fs.existsSync('./.data/db')) fs.mkdirSync('./.data/db');

const db = new Datastore({ filename: './.data/db/pushes.db', autoload: true });

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

export const writeAudit = async (action: Action) => {
  return new Promise((resolve, reject) => {
    const options = { multi: false, upsert: true };
    db.update({ id: action.id }, action, options, (err) => {
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

export const canUserCancelPush = async (id: string, user: any) => {
  return new Promise<boolean>(async (resolve) => {
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

export const canUserApproveRejectPush = async (id: string, user: any) => {
  return new Promise<boolean>(async (resolve) => {
    const action = await getPush(id);
    if (!action) {
      resolve(false);
      return;
    }
    const repoName = action?.repoName.replace('.git', '');
    const isAllowed = await repo.canUserApproveRejectPushRepo(repoName, user);

    resolve(isAllowed);
  });
};
