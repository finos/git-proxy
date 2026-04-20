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
import { getAxiosConfig } from './auth.js';
import { Repo } from '../../db/types';
import { RepoView } from '../types';
import { getApiV1BaseUrl } from './apiConfig';
import { ServiceResult, getServiceError, errorResult, successResult } from './errors';
import { SCMRepositoryMetadata } from '../types';

const compareRepoName = (a: RepoView, b: RepoView, direction: 'asc' | 'desc'): number => {
  const cmp = (a.name ?? '').localeCompare(b.name ?? '');
  return direction === 'asc' ? cmp : -cmp;
};

const userIsContributorOrReviewer = (repo: RepoView, username: string): boolean => {
  const { canPush, canAuthorise } = repo.users;
  return canPush.includes(username) || canAuthorise.includes(username);
};

const compareRelevance = (
  a: RepoView,
  b: RepoView,
  currentUsername: string | null | undefined,
): number => {
  const u = currentUsername?.trim();
  const aMine = u ? userIsContributorOrReviewer(a, u) : false;
  const bMine = u ? userIsContributorOrReviewer(b, u) : false;
  if (aMine !== bMine) {
    return aMine ? -1 : 1;
  }
  return compareRepoName(a, b, 'asc');
};

const totalActivity = (repo: RepoView): number => {
  if (!repo.activity) return 0;
  const { pending, approved, canceled, rejected, error } = repo.activity;
  return pending + approved + canceled + rejected + error;
};

const compareLatestPendingReview = (a: RepoView, b: RepoView): number => {
  const aMs = a.latestPendingReviewAtMs ?? Number.NEGATIVE_INFINITY;
  const bMs = b.latestPendingReviewAtMs ?? Number.NEGATIVE_INFINITY;
  if (bMs !== aMs) {
    return bMs - aMs;
  }
  return compareRepoName(a, b, 'asc');
};

const compareLatestPush = (a: RepoView, b: RepoView, direction: 'asc' | 'desc'): number => {
  if (direction === 'desc') {
    const aMs = a.latestPushAtMs ?? Number.NEGATIVE_INFINITY;
    const bMs = b.latestPushAtMs ?? Number.NEGATIVE_INFINITY;
    if (bMs !== aMs) {
      return bMs - aMs;
    }
  } else {
    const aMs = a.latestPushAtMs ?? Number.POSITIVE_INFINITY;
    const bMs = b.latestPushAtMs ?? Number.POSITIVE_INFINITY;
    if (aMs !== bMs) {
      return aMs - bMs;
    }
  }
  return compareRepoName(a, b, 'asc');
};

export const sortRepoViews = (
  repos: RepoView[],
  sort: RepoSortField,
  currentUsername?: string | null,
): RepoView[] => {
  const next = [...repos];
  switch (sort) {
    case 'relevance':
      next.sort((a, b) => compareRelevance(a, b, currentUsername));
      break;
    case 'activity':
      next.sort((a, b) => totalActivity(b) - totalActivity(a));
      break;
    case 'latestPendingReview':
      next.sort((a, b) => compareLatestPendingReview(a, b));
      break;
    case 'lastPushed-desc':
      next.sort((a, b) => compareLatestPush(a, b, 'desc'));
      break;
    case 'lastPushed-asc':
      next.sort((a, b) => compareLatestPush(a, b, 'asc'));
      break;
    case 'name-desc':
      next.sort((a, b) => compareRepoName(a, b, 'desc'));
      break;
    default:
      next.sort((a, b) => compareRepoName(a, b, 'asc'));
  }
  return next;
};

const canAddUser = async (repoId: string, user: string, action: string) => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${repoId}`);

  try {
    const response = await axios.get<Repo>(url.toString(), getAxiosConfig());
    const repo = response.data;
    if (action === 'authorise') {
      return !repo.users.canAuthorise.includes(user);
    } else {
      return !repo.users.canPush.includes(user);
    }
  } catch (error: unknown) {
    const { message } = getServiceError(error, 'Failed to validate repo permissions');
    throw new Error(message);
  }
};

class DupUserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'The user already has this role.';
  }
}

const fetchRepoViews = async (): Promise<ServiceResult<RepoView[]>> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo`);

  try {
    const response = await axios<RepoView[]>(url.toString(), getAxiosConfig());
    return successResult(response.data);
  } catch (error: unknown) {
    return errorResult(error, 'Failed to load repositories');
  }
};

const getRepo = async (id: string): Promise<ServiceResult<RepoView>> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${id}`);

  try {
    const response = await axios<RepoView>(url.toString(), getAxiosConfig());
    return successResult(response.data);
  } catch (error: unknown) {
    return errorResult(error, 'Failed to load repository');
  }
};

const getRepoScmMetadata = async (
  id: string,
): Promise<ServiceResult<SCMRepositoryMetadata | null>> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${id}/scm-metadata`);

  try {
    const response = await axios.get<SCMRepositoryMetadata | null>(
      url.toString(),
      getAxiosConfig(),
    );
    return successResult(response.data ?? null);
  } catch (error: unknown) {
    return errorResult(error, 'Failed to load SCM metadata');
  }
};

const addRepo = async (repo: RepoView): Promise<ServiceResult<RepoView>> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo`);

  try {
    const response = await axios.post<RepoView>(url.toString(), repo, getAxiosConfig());
    return successResult(response.data);
  } catch (error: unknown) {
    return errorResult(error, 'Failed to add repository');
  }
};

const addUser = async (repoId: string, user: string, action: string): Promise<void> => {
  const canAdd = await canAddUser(repoId, user, action);
  if (canAdd) {
    const apiV1Base = await getApiV1BaseUrl();
    const url = new URL(`${apiV1Base}/repo/${repoId}/user/${action}`);
    const data = { username: user };

    try {
      await axios.patch(url.toString(), data, getAxiosConfig());
    } catch (error: unknown) {
      const { message } = getServiceError(error, 'Failed to add user');
      console.log(message);
      throw new Error(message);
    }
  } else {
    console.log('Duplicate user can not be added');
    throw new DupUserValidationError('Duplicate user can not be added');
  }
};

const deleteUser = async (user: string, repoId: string, action: string): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${repoId}/user/${action}/${user}`);

  try {
    await axios.delete(url.toString(), getAxiosConfig());
  } catch (error: unknown) {
    const { message } = getServiceError(error, 'Failed to remove user');
    console.log(message);
    throw new Error(message);
  }
};

const deleteRepo = async (repoId: string): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${repoId}/delete`);

  try {
    await axios.delete(url.toString(), getAxiosConfig());
  } catch (error: unknown) {
    const { message } = getServiceError(error, 'Failed to delete repository');
    console.log(message);
    throw new Error(message);
  }
};

export { addUser, deleteUser, fetchRepoViews, getRepo, getRepoScmMetadata, addRepo, deleteRepo };
