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
import axios from 'axios';
import { getCookie } from '../utils.jsx';

const baseUrl = import.meta.env.VITE_API_URI
  ? `${import.meta.env.VITE_API_URI}/api/v1`
  : `${location.origin}/api/v1`;

const config = {
  withCredentials: true,
};

const getUser = async (setIsLoading, setData, setAuth, setIsError) => {
  const url = new URL(`${location.origin}/api/auth/success`);
  await axios(url.toString(), config)
    .then((response) => {
      const data = response.data;
      setData(data);
      setIsLoading(false);
    })
    .catch((error) => {
      if (error.response && error.response.status === 401) setAuth(false);
      else setIsError(true);
      setIsLoading(false);
    });
};

const getPush = async (id, setIsLoading, setData, setAuth, setIsError) => {
  const url = `${baseUrl}/push/${id}`;
  await axios(url, config)
    .then((response) => {
      const data = response.data;
      data.diff = data.steps.find((x) => x.stepName === 'diff');
      setData(data);
      setIsLoading(false);
    })
    .catch((error) => {
      if (error.response && error.response.status === 401) setAuth(false);
      else setIsError(true);
      setIsLoading(false);
    });
};

const getPushes = async (
  setIsLoading,
  setData,
  setAuth,
  setIsError,
  query = {
    blocked: true,
    canceled: false,
    authorised: false,
    rejected: false,
  },
) => {
  const url = new URL(`${baseUrl}/push`);
  url.search = new URLSearchParams(query);

  setIsLoading(true);
  await axios(url.toString(), { withCredentials: true })
    .then((response) => {
      const data = response.data;
      setData(data);
      setIsLoading(false);
    })
    .catch((error) => {
      setIsLoading(false);
      if (error.response && error.response.status === 401) {
        setAuth(false);
      } else {
        setIsError(true);
      }
      setIsLoading(false);
    });
};

const authorisePush = async (id, setMessage, setUserAllowedToApprove, attestation) => {
  const url = `${baseUrl}/push/${id}/authorise`;
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
      { withCredentials: true, headers: { 'X-CSRF-TOKEN': getCookie('csrf') } },
    )
    .catch((error) => {
      if (error.response && error.response.status === 401) {
        errorMsg = 'You are not authorised to approve...';
        isUserAllowedToApprove = false;
      }
    });
  await setMessage(errorMsg);
  await setUserAllowedToApprove(isUserAllowedToApprove);
};

const rejectPush = async (id, setMessage, setUserAllowedToReject) => {
  const url = `${baseUrl}/push/${id}/reject`;
  let errorMsg = '';
  let isUserAllowedToReject = true;
  await axios
    .post(url, {}, { withCredentials: true, headers: { 'X-CSRF-TOKEN': getCookie('csrf') } })
    .catch((error) => {
      if (error.response && error.response.status === 401) {
        errorMsg = 'You are not authorised to reject...';
        isUserAllowedToReject = false;
      }
    });
  await setMessage(errorMsg);
  await setUserAllowedToReject(isUserAllowedToReject);
};

const cancelPush = async (id, setAuth, setIsError) => {
  const url = `${baseUrl}/push/${id}/cancel`;
  await axios
    .post(url, {}, { withCredentials: true, headers: { 'X-CSRF-TOKEN': getCookie('csrf') } })
    .catch((error) => {
      if (error.response && error.response.status === 401) {
        setAuth(false);
      } else {
        setIsError(true);
      }
    });
};

export { getPush, getPushes, authorisePush, rejectPush, cancelPush, getUser };
