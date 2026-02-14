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

import axios from 'axios';
import { getAxiosConfig, processAuthError } from './auth';
import { getBaseUrl, getApiV1BaseUrl } from './apiConfig';
import { Action, Step } from '../../proxy/actions';
import { PushActionView } from '../types';

const getPush = async (
  id: string,
  setIsLoading: (isLoading: boolean) => void,
  setPush: (push: PushActionView) => void,
  setAuth: (auth: boolean) => void,
  setIsError: (isError: boolean) => void,
): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}`;
  setIsLoading(true);

  try {
    const response = await axios<Action>(url, getAxiosConfig());
    const data: Action & { diff?: Step } = response.data;
    data.diff = data.steps.find((x: Step) => x.stepName === 'diff');
    setPush(data as PushActionView);
  } catch (error: any) {
    if (error.response?.status === 401) setAuth(false);
    else setIsError(true);
  } finally {
    setIsLoading(false);
  }
};

const getPushes = async (
  setIsLoading: (isLoading: boolean) => void,
  setPushes: (pushes: PushActionView[]) => void,
  setAuth: (auth: boolean) => void,
  setIsError: (isError: boolean) => void,
  setErrorMessage: (errorMessage: string) => void,
  query = {
    blocked: true,
    canceled: false,
    authorised: false,
    rejected: false,
  },
): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/push`);
  url.search = new URLSearchParams(query as any).toString();

  setIsLoading(true);

  try {
    const response = await axios<Action[]>(url.toString(), getAxiosConfig());
    setPushes(response.data as PushActionView[]);
  } catch (error: any) {
    setIsError(true);

    if (error.response?.status === 401) {
      setAuth(false);
      setErrorMessage(processAuthError(error));
    } else {
      const message = error.response?.data?.message || error.message;
      setErrorMessage(`Error fetching pushes: ${message}`);
    }
  } finally {
    setIsLoading(false);
  }
};

const authorisePush = async (
  id: string,
  setMessage: (message: string) => void,
  setUserAllowedToApprove: (userAllowedToApprove: boolean) => void,
  attestation: Array<{ label: string; checked: boolean }>,
): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}/authorise`;
  let errorMsg = '';
  let isUserAllowedToApprove = true;
  await axios
    .post(
      url,
      {
        params: {
          attestation,
        },
      },
      getAxiosConfig(),
    )
    .catch((error: any) => {
      if (error.response && error.response.status === 401) {
        errorMsg = 'You are not authorised to approve...';
        isUserAllowedToApprove = false;
      }
    });
  setMessage(errorMsg);
  setUserAllowedToApprove(isUserAllowedToApprove);
};

const rejectPush = async (
  id: string,
  setMessage: (message: string) => void,
  setUserAllowedToReject: (userAllowedToReject: boolean) => void,
): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}/reject`;
  let errorMsg = '';
  let isUserAllowedToReject = true;
  await axios.post(url, {}, getAxiosConfig()).catch((error: any) => {
    if (error.response && error.response.status === 401) {
      errorMsg = 'You are not authorised to reject...';
      isUserAllowedToReject = false;
    }
  });
  setMessage(errorMsg);
  setUserAllowedToReject(isUserAllowedToReject);
};

const cancelPush = async (
  id: string,
  setAuth: (auth: boolean) => void,
  setIsError: (isError: boolean) => void,
): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}/cancel`;
  await axios.post(url, {}, getAxiosConfig()).catch((error: any) => {
    if (error.response && error.response.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }
  });
};

export { getPush, getPushes, authorisePush, rejectPush, cancelPush };
