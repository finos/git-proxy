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
import { QuestionFormData } from '../types';
import { UIRouteAuth } from '../../config/generated/config';
import { getApiV1BaseUrl } from './apiConfig';

const setAttestationConfigData = async (setData: (data: QuestionFormData[]) => void) => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/config/attestation`);
  await axios(url.toString()).then((response) => {
    setData(response.data.questions);
  });
};

const setURLShortenerData = async (setData: (data: string) => void) => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/config/urlShortener`);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

const setEmailContactData = async (setData: (data: string) => void) => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/config/contactEmail`);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

const setUIRouteAuthData = async (setData: (data: UIRouteAuth) => void) => {
  const apiV1Base = await getApiV1BaseUrl();
  const urlString = `${apiV1Base}/config/uiRouteAuth`;
  console.log(`URL: ${urlString}`);
  const url = new URL(urlString);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

export { setAttestationConfigData, setURLShortenerData, setEmailContactData, setUIRouteAuthData };
