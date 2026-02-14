/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
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

import { Action, Step } from '../../actions';
import { getCommitConfig } from '../../../config';
import { CommitData } from '../types';
import { isEmail } from 'validator';

const isEmailAllowed = (email: string): boolean => {
  const commitConfig = getCommitConfig();

  if (!email || !isEmail(email)) {
    return false;
  }

  const [emailLocal, emailDomain] = email.split('@');

  if (
    commitConfig?.author?.email?.domain?.allow &&
    !new RegExp(commitConfig.author.email.domain.allow, 'gi').test(emailDomain)
  ) {
    return false;
  }

  if (
    commitConfig?.author?.email?.local?.block &&
    new RegExp(commitConfig.author.email.local.block, 'gi').test(emailLocal)
  ) {
    return false;
  }

  return true;
};

const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkAuthorEmails');

  const uniqueAuthorEmails = [
    ...new Set(action.commitData?.map((commitData: CommitData) => commitData.authorEmail)),
  ];

  const illegalEmails = uniqueAuthorEmails.filter((email) => !isEmailAllowed(email));

  if (illegalEmails.length > 0) {
    console.log(`The following commit author e-mails are illegal: ${illegalEmails}`);

    step.error = true;
    step.log(`The following commit author e-mails are illegal: ${illegalEmails}`);
    step.setError(
      'Your push has been blocked. Please verify your Git configured e-mail address is valid (e.g. john.smith@example.com)',
    );

    action.addStep(step);
    return action;
  }

  console.log(`The following commit author e-mails are legal: ${uniqueAuthorEmails}`);
  action.addStep(step);
  return action;
};

exec.displayName = 'checkAuthorEmails.exec';

export { exec };
