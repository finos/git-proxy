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
import { errorResult, formatErrorMessage, getServiceError, successResult } from './errors';
import type { ServiceResult } from './errors';
import type { UserSortField } from '../views/UserList/Components/userSortField';
import { DEFAULT_USER_SORT, userSortDirection } from '../views/UserList/Components/userSortField';

type SetStateCallback<T> = (value: T | ((prevValue: T) => T)) => void;

const userNameSortKey = (user: PublicUser): string =>
  (user.displayName?.trim() || user.username || '').toLowerCase();

const totalUserActivity = (user: PublicUser): number => {
  if (!user.activity) return 0;
  const { pending, approved, canceled, rejected, error } = user.activity;
  return pending + approved + canceled + rejected + error;
};

const sortUsers = (users: PublicUser[], sort: UserSortField): PublicUser[] => {
  const next = [...users];
  if (sort === 'activity') {
    next.sort((a, b) => totalUserActivity(b) - totalUserActivity(a));
    return next;
  }
  const direction = userSortDirection(sort);
  next.sort((a, b) => {
    const cmp = userNameSortKey(a).localeCompare(userNameSortKey(b), undefined, {
      sensitivity: 'base',
    });
    return direction === 'asc' ? cmp : -cmp;
  });
  return next;
};

const getUser = async (
  setIsLoading?: SetStateCallback<boolean>,
  setUser?: (user: PublicUser | null) => void,
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
      setUser?.(null);
      setAuth?.(false);
      setErrorMessage?.(processAuthError(error as AxiosError<BackendResponse>));
    } else {
      setErrorMessage?.(formatErrorMessage('Error fetching user', status, message));
    }
    setIsLoading?.(false);
  }
};

const getUsers = async (
  setIsLoading: SetStateCallback<boolean>,
  setUsers: SetStateCallback<PublicUser[]>,
  setAuth: SetStateCallback<boolean>,
  setErrorMessage: SetStateCallback<string>,
  sort: UserSortField = DEFAULT_USER_SORT,
): Promise<void> => {
  setIsLoading(true);

  try {
    const apiV1BaseUrl = await getApiV1BaseUrl();
    const response: AxiosResponse<PublicUser[]> = await axios(
      `${apiV1BaseUrl}/user`,
      getAxiosConfig(),
    );
    setUsers(sortUsers(response.data, sort));
  } catch (error) {
    const { status, message } = getServiceError(error, 'Unknown error');
    if (status === 401) {
      setAuth(false);
      setErrorMessage(processAuthError(error as AxiosError<BackendResponse>));
    } else {
      setErrorMessage(formatErrorMessage('Error fetching users', status, message));
    }
  } finally {
    setIsLoading(false);
  }
};

const fetchUsersForAutocomplete = async (): Promise<PublicUser[]> => {
  const apiV1BaseUrl = await getApiV1BaseUrl();
  const response: AxiosResponse<PublicUser[]> = await axios(
    `${apiV1BaseUrl}/user`,
    getAxiosConfig(),
  );
  return sortUsers(response.data, DEFAULT_USER_SORT);
};

const resolveUsernameByEmail = async (email: string): Promise<ServiceResult<string | null>> => {
  try {
    const apiV1BaseUrl = await getApiV1BaseUrl();
    const url = new URL(`${apiV1BaseUrl}/user/lookup/by-email`);
    url.searchParams.set('email', email.trim().toLowerCase());
    const response: AxiosResponse<{ username: string | null }> = await axios(
      url.toString(),
      getAxiosConfig(),
    );
    return successResult(response.data.username);
  } catch (error) {
    return errorResult(error, 'Error resolving user by email');
  }
};

/**
 * Returns the user's display name from the directory, or null if unavailable.
 */
const resolveDisplayNameByUsername = async (username: string): Promise<string | null> => {
  const key = username.trim().toLowerCase();
  if (!key) {
    return null;
  }

  try {
    const apiV1BaseUrl = await getApiV1BaseUrl();
    const response: AxiosResponse<PublicUser> = await axios(
      `${apiV1BaseUrl}/user/${encodeURIComponent(key)}`,
      getAxiosConfig(),
    );
    const dn = response.data.displayName?.trim();
    return dn || null;
  } catch {
    return null;
  }
};

const updateUser = async (
  user: PublicUser,
  setErrorMessage: SetStateCallback<string>,
): Promise<void> => {
  try {
    const baseUrl = await getBaseUrl();
    await axios.post(`${baseUrl}/api/auth/gitAccount`, user, getAxiosConfig());
  } catch (error: unknown) {
    const { status, message } = getServiceError(error, 'Unknown error');
    setErrorMessage(formatErrorMessage('Error updating user', status, message));
    throw error;
  }
};

export {
  getUser,
  getUsers,
  fetchUsersForAutocomplete,
  sortUsers,
  resolveUsernameByEmail,
  resolveDisplayNameByUsername,
  updateUser,
};
