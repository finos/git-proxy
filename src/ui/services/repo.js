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

const canAddUser = (repoName, user, action) => {
  const url = new URL(`${baseUrl}/repo/${repoName}`);
  return axios
    .get(url.toString(), config)
    .then((response) => {
      const data = response.data;
      if (action === 'authorise') {
        return !data.users.canAuthorise.includes(user);
      } else {
        return !data.users.canPush.includes(user);
      }
    })
    .catch((error) => {
      throw error;
    });
};

class DupUserValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'The user already has this role...';
  }
}

const getRepos = async (setIsLoading, setData, setAuth, setIsError, query = {}) => {
  const url = new URL(`${baseUrl}/repo`);
  url.search = new URLSearchParams(query);
  setIsLoading(true);
  await axios(url.toString(), config)
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

const getRepo = async (setIsLoading, setData, setAuth, setIsError, id) => {
  const url = new URL(`${baseUrl}/repo/${id}`);
  setIsLoading(true);
  await axios(url.toString(), config)
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

const addRepo = async (onClose, setError, data) => {
  const url = new URL(`${baseUrl}/repo`);
  axios
    .post(url, data, { withCredentials: true, headers: { 'X-CSRF-TOKEN': getCookie('csrf') } })
    .then(() => {
      onClose();
    })
    .catch((error) => {
      console.log(error.response.data.message);
      setError(error.response.data.message);
    });
};

const addUser = async (repoName, user, action) => {
  const canAdd = await canAddUser(repoName, user, action);
  if (canAdd) {
    const url = new URL(`${baseUrl}/repo/${repoName}/user/${action}`);
    const data = { username: user };
    await axios
      .patch(url, data, { withCredentials: true, headers: { 'X-CSRF-TOKEN': getCookie('csrf') } })
      .catch((error) => {
        console.log(error.response.data.message);
        throw error;
      });
  } else {
    console.log('Duplicate user can not be added');
    throw new DupUserValidationError();
  }
};

const deleteUser = async (user, repoName, action) => {
  const url = new URL(`${baseUrl}/repo/${repoName}/user/${action}/${user}`);

  await axios
    .delete(url, { withCredentials: true, headers: { 'X-CSRF-TOKEN': getCookie('csrf') } })
    .catch((error) => {
      console.log(error.response.data.message);
      throw error;
    });
};

const deleteRepo = async (repoName) => {
  const url = new URL(`${baseUrl}/repo/${repoName}/delete`);

  await axios
    .delete(url, { withCredentials: true, headers: { 'X-CSRF-TOKEN': getCookie('csrf') } })
    .catch((error) => {
      console.log(error.response.data.message);
      throw error;
    });
};

export { addUser, deleteUser, getRepos, getRepo, addRepo, deleteRepo };
