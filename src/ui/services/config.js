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

const baseUrl = import.meta.env.VITE_API_URI
  ? `${import.meta.env.VITE_API_URI}/api/v1`
  : `${location.origin}/api/v1`;

const getAttestationConfig = async (setData) => {
  const url = new URL(`${baseUrl}/config/attestation`);
  await axios(url.toString()).then((response) => {
    setData(response.data.questions);
  });
};

const getURLShortener = async (setData) => {
  const url = new URL(`${baseUrl}/config/urlShortener`);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

const getEmailContact = async (setData) => {
  const url = new URL(`${baseUrl}/config/contactEmail`);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

export { getAttestationConfig, getURLShortener, getEmailContact };
