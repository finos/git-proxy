import axios from 'axios';
import { getAxiosConfig } from './auth.js';
import { Repo } from '../../db/types';
import { RepoView } from '../types';
import { getApiV1BaseUrl } from './apiConfig';
import { ServiceResult, getServiceError, errorResult, successResult } from './errors';

const canAddUser = async (repoId: string, user: string, action: string) => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${repoId}`);
  return axios
    .get<Repo>(url.toString(), getAxiosConfig())
    .then((response) => {
      const repo = response.data;
      if (action === 'authorise') {
        return !repo.users.canAuthorise.includes(user);
      } else {
        return !repo.users.canPush.includes(user);
      }
    })
    .catch((error: any) => {
      const { message } = getServiceError(error, 'Failed to validate repo permissions');
      throw new Error(message);
    });
};

class DupUserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'The user already has this role...';
  }
}

const getRepos = async (
  query: Record<string, boolean> = {},
): Promise<ServiceResult<RepoView[]>> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo`);
  url.search = new URLSearchParams(query as any).toString();

  try {
    const response = await axios<RepoView[]>(url.toString(), getAxiosConfig());
    const sortedRepos = response.data.sort((a: RepoView, b: RepoView) =>
      a.name.localeCompare(b.name),
    );
    return successResult(sortedRepos);
  } catch (error: any) {
    return errorResult(error, 'Failed to load repositories');
  }
};

const getRepo = async (id: string): Promise<ServiceResult<RepoView>> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${id}`);

  try {
    const response = await axios<RepoView>(url.toString(), getAxiosConfig());
    return successResult(response.data);
  } catch (error: any) {
    return errorResult(error, 'Failed to load repository');
  }
};

const addRepo = async (repo: RepoView): Promise<ServiceResult<RepoView>> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo`);

  try {
    const response = await axios.post<RepoView>(url.toString(), repo, getAxiosConfig());
    return successResult(response.data);
  } catch (error: any) {
    return errorResult(error, 'Failed to add repository');
  }
};

const addUser = async (repoId: string, user: string, action: string): Promise<void> => {
  const canAdd = await canAddUser(repoId, user, action);
  if (canAdd) {
    const apiV1Base = await getApiV1BaseUrl();
    const url = new URL(`${apiV1Base}/repo/${repoId}/user/${action}`);
    const data = { username: user };
    await axios.patch(url.toString(), data, getAxiosConfig()).catch((error: any) => {
      const { message } = getServiceError(error, 'Failed to add user');
      console.log(message);
      throw new Error(message);
    });
  } else {
    console.log('Duplicate user can not be added');
    throw new DupUserValidationError('Duplicate user can not be added');
  }
};

const deleteUser = async (user: string, repoId: string, action: string): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${repoId}/user/${action}/${user}`);

  await axios.delete(url.toString(), getAxiosConfig()).catch((error: any) => {
    const { message } = getServiceError(error, 'Failed to remove user');
    console.log(message);
    throw new Error(message);
  });
};

const deleteRepo = async (repoId: string): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${repoId}/delete`);

  await axios.delete(url.toString(), getAxiosConfig()).catch((error: any) => {
    const { message } = getServiceError(error, 'Failed to delete repository');
    console.log(message);
    throw new Error(message);
  });
};

export { addUser, deleteUser, getRepos, getRepo, addRepo, deleteRepo };
