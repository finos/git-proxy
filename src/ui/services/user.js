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
  ? `${import.meta.env.VITE_API_URI}`
  : `${location.origin}`;

const config = {
  withCredentials: true,
};

const getUser = async (setIsLoading, setData, setAuth, setIsError, id = null) => {
  let url = `${baseUrl}/api/auth/profile`;

  if (id) {
    url = `${baseUrl}/api/v1/user/${id}`;
  }

  console.log(url);

  await axios(url, config)
    .then((response) => {
      const data = response.data;
      if (setData) {
        setData(data);
      }
      if (setIsLoading) {
        setIsLoading(false);
      }
    })
    .catch((error) => {
      if (error.response && error.response.status === 401) {
        if (setAuth) {
          setAuth(false);
        }
      } else {
        if (setIsError) {
          setIsError(true);
        }
      }
      if (setIsLoading) {
        setIsLoading(false);
      }
    });
};

const getUsers = async (setIsLoading, setData, setAuth, setIsError, query = {}) => {
  const url = new URL(`${baseUrl}/api/v1/user`);
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

const updateUser = async (data) => {
  console.log(data);
  const url = new URL(`${baseUrl}/api/auth/gitAccount`);
  await axios
    .post(url, data, { withCredentials: true, headers: { 'X-CSRF-TOKEN': getCookie('csrf') } })
    .catch((error) => {
      console.log(error.response.data.message);
      throw error;
    });
};

const getUserLoggedIn = async (setIsLoading, setIsAdmin, setIsError, setAuth) => {
  const url = new URL(`${baseUrl}/api/auth/userLoggedIn`);

  await axios(url.toString(), { withCredentials: true })
    .then((response) => {
      const data = response.data;
      setIsLoading(false);
      setIsAdmin(data.admin);
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

export { getUser, getUsers, updateUser, getUserLoggedIn };
