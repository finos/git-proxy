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
import { Action, Step } from '../../actions';
import { getPush } from '../../../db';

// Execute function
const exec = async (req: any, action: Action): Promise<Action> => {
  const step = new Step('checkIfWaitingAuth');
  try {
    const existingAction = await getPush(action.id);
    if (existingAction) {
      if (!action.error) {
        if (existingAction.authorised) {
          action = existingAction;
          action.setAllowPush();
        }
      }
    }
  } catch (e: any) {
    step.setError(e.toString('utf-8'));
    throw e;
  } finally {
    action.addStep(step);
  }
  return action;
};

exec.displayName = 'checkIfWaitingAuth.exec';

export { exec };
