/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import axios, { AxiosError, AxiosResponse } from 'axios';
import { getAxiosConfig, processAuthError } from './auth';
import { PublicUser } from '../../db/types';
import { BackendResponse } from '../types';
import { getBaseUrl, getApiV1BaseUrl } from './apiConfig';
import {
  getServiceError,
  formatErrorMessage,
  ServiceResult,
  errorResult,
  successResult,
} from './errors';
import { PaginationParams } from './git-push';

export type PagedUserResponse = {
  users: PublicUser[];
  total: number;
};

type SetStateCallback<T> = (value: T | ((prevValue: T) => T)) => void;

const getUser = async (
  setIsLoading?: SetStateCallback<boolean>,
  setUser?: (user: PublicUser) => void,
  setAuth?: SetStateCallback<boolean>,
  setErrorMessage?: SetStateCallback<string>,
  id: string | null = null,
): Promise<void> => {
  const baseUrl = await getBaseUrl();
  const apiV1BaseUrl = await getApiV1BaseUrl();

  let url = `${baseUrl}/api/auth/profile`;
  if (id) {
    url = `${apiV1BaseUrl}/user/${id}`;
  }

  try {
    const response: AxiosResponse<PublicUser> = await axios(url, getAxiosConfig());
    const user = response.data;

    setUser?.(user);
    setIsLoading?.(false);
  } catch (error: unknown) {
    const { status, message } = getServiceError(error, 'Unknown error');
    if (status === 401) {
      setAuth?.(false);
      setErrorMessage?.(processAuthError(error as AxiosError<BackendResponse>));
    } else {
      setErrorMessage?.(formatErrorMessage('Error fetching user', status, message));
    }
    setIsLoading?.(false);
  }
};

const getUsers = async (
  pagination: PaginationParams = {},
): Promise<ServiceResult<PagedUserResponse>> => {
  try {
    const apiV1BaseUrl = await getApiV1BaseUrl();
    const url = new URL(`${apiV1BaseUrl}/user`);
    const params: Record<string, string> = {};
    if (pagination.page) params['page'] = String(pagination.page);
    if (pagination.limit) params['limit'] = String(pagination.limit);
    if (pagination.search) params['search'] = pagination.search;
    if (pagination.sortBy) params['sortBy'] = pagination.sortBy;
    if (pagination.sortOrder) params['sortOrder'] = pagination.sortOrder;
    url.search = new URLSearchParams(params).toString();

    const response: AxiosResponse<{ users: PublicUser[]; total: number }> = await axios(
      url.toString(),
      getAxiosConfig(),
    );
    return successResult({ users: response.data.users, total: response.data.total });
  } catch (error: unknown) {
    return errorResult(error, 'Failed to load users');
  }
};

const updateUser = async (
  user: PublicUser,
  setErrorMessage: SetStateCallback<string>,
  setIsLoading: SetStateCallback<boolean>,
): Promise<void> => {
  try {
    const baseUrl = await getBaseUrl();
    await axios.post(`${baseUrl}/api/auth/gitAccount`, user, getAxiosConfig());
  } catch (error: unknown) {
    const { status, message } = getServiceError(error, 'Unknown error');
    setErrorMessage(formatErrorMessage('Error updating user', status, message));
    setIsLoading(false);
  }
};

export { getUser, getUsers, updateUser };
