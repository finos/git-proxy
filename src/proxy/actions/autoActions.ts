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
import { authorise, reject } from '../../db';
import { Action } from './Action';

const attemptAutoApproval = async (action: Action) => {
  try {
    const attestation = {
      timestamp: new Date(),
      autoApproved: true,
    };
    await authorise(action.id, attestation);
    console.log('Push automatically approved by system.');

    return true;
  } catch (error: any) {
    console.error('Error during auto-approval:', error.message);
    return false;
  }
};

const attemptAutoRejection = async (action: Action) => {
  try {
    const attestation = {
      timestamp: new Date(),
      autoApproved: true,
    };
    await reject(action.id, attestation);
    console.log('Push automatically rejected by system.');

    return true;
  } catch (error: any) {
    console.error('Error during auto-rejection:', error.message);
    return false;
  }
};

export {
  attemptAutoApproval,
  attemptAutoRejection,
};
