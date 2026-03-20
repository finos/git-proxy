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

import axios from 'axios';
import { getAxiosConfig } from './auth';
import { getApiV1BaseUrl } from './apiConfig';
import { Action, Step } from '../../proxy/actions';
import { PushActionView } from '../types';
import { ServiceResult, errorResult, successResult } from './errors';

const getPush = async (id: string): Promise<ServiceResult<PushActionView>> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}`;

  try {
    const response = await axios<Action>(url, getAxiosConfig());
    const data: Action = response.data;
    const actionView: PushActionView = {
      ...data,
      diff: data.steps.find((x: Step) => x.stepName === 'diff')!,
    };
    return successResult(actionView);
  } catch (error: unknown) {
    return errorResult(error, 'Failed to load push');
  }
};

export type PaginationParams = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type PagedResponse<T> = {
  data: T[];
  total: number;
};

const getPushes = async (
  query: Record<string, boolean | string> = {
    blocked: true,
    canceled: false,
    authorised: false,
    rejected: false,
  },
  pagination: PaginationParams = {},
): Promise<ServiceResult<PagedResponse<PushActionView>>> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/push`);

  const params: Record<string, string> = Object.fromEntries(
    Object.entries(query).map(([k, v]) => [k, v.toString()]),
  );
  if (pagination.page) params['page'] = String(pagination.page);
  if (pagination.limit) params['limit'] = String(pagination.limit);
  if (pagination.search) params['search'] = pagination.search;
  if (pagination.sortBy) params['sortBy'] = pagination.sortBy;
  if (pagination.sortOrder) params['sortOrder'] = pagination.sortOrder;
  url.search = new URLSearchParams(params).toString();

  try {
    const response = await axios<PagedResponse<Action>>(url.toString(), getAxiosConfig());
    const paged = response.data as unknown as PagedResponse<PushActionView>;
    return successResult(paged);
  } catch (error: unknown) {
    return errorResult(error, 'Failed to load pushes');
  }
};

const authorisePush = async (
  id: string,
  attestation: Array<{ label: string; checked: boolean }>,
): Promise<ServiceResult> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}/authorise`;

  try {
    await axios.post(
      url,
      {
        params: {
          attestation,
        },
      },
      getAxiosConfig(),
    );
    return successResult();
  } catch (error: unknown) {
    return errorResult(error, 'Failed to approve push request');
  }
};

const rejectPush = async (id: string, reason?: string): Promise<ServiceResult> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}/reject`;

  try {
    await axios.post(url, { reason }, getAxiosConfig());
    return successResult();
  } catch (error: unknown) {
    return errorResult(error, 'Failed to reject push request');
  }
};

const cancelPush = async (id: string): Promise<ServiceResult> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}/cancel`;

  try {
    await axios.post(url, {}, getAxiosConfig());
    return successResult();
  } catch (error: unknown) {
    return errorResult(error, 'Failed to cancel push request');
  }
};

export { getPush, getPushes, authorisePush, rejectPush, cancelPush };
