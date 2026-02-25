import axios, { AxiosError } from 'axios';
import { getAxiosConfig, processAuthError } from './auth.js';
import { Repo } from '../../db/types';
import { RepoView } from '../types';
import { getApiV1BaseUrl } from './apiConfig';

const canAddUser = async (repoId: string, user: string, action: string) => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${repoId}`);
  const response = await axios.get<Repo>(url.toString(), getAxiosConfig());
  const repo = response.data;
  if (action === 'authorise') {
    return !repo.users.canAuthorise.includes(user);
  } else {
    return !repo.users.canPush.includes(user);
  }
};

class DupUserValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'The user already has this role...';
  }
}

const getRepos = async (
  setIsLoading: (isLoading: boolean) => void,
  setRepos: (repos: RepoView[]) => void,
  setAuth: (auth: boolean) => void,
  setIsError: (isError: boolean) => void,
  setErrorMessage: (errorMessage: string) => void,
  query: Record<string, boolean> = {},
): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo`);
  url.search = new URLSearchParams(query as any).toString();
  setIsLoading(true);
  try {
    const response = await axios<RepoView[]>(url.toString(), getAxiosConfig());
    const sortedRepos = response.data.sort((a: RepoView, b: RepoView) =>
      a.name.localeCompare(b.name),
    );
    setRepos(sortedRepos);
  } catch (error: unknown) {
    setIsError(true);
    if (error instanceof AxiosError && error.response?.status === 401) {
      setAuth(false);
      setErrorMessage(processAuthError(error));
    } else if (error instanceof AxiosError) {
      setErrorMessage(`Error fetching repos: ${error.response?.data?.message}`);
    }
  } finally {
    setIsLoading(false);
  }
};

const getRepo = async (
  setIsLoading: (isLoading: boolean) => void,
  setRepo: (repo: RepoView) => void,
  setAuth: (auth: boolean) => void,
  setIsError: (isError: boolean) => void,
  id: string,
): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${id}`);
  setIsLoading(true);
  try {
    const response = await axios<RepoView>(url.toString(), getAxiosConfig());
    const repo = response.data;
    setRepo(repo);
  } catch (error: unknown) {
    if (error instanceof AxiosError && error.response?.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }
  } finally {
    setIsLoading(false);
  }
};

const addRepo = async (
  repo: RepoView,
): Promise<{ success: boolean; message?: string; repo: RepoView | null }> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo`);

  try {
    const response = await axios.post<RepoView>(url.toString(), repo, getAxiosConfig());
    return {
      success: true,
      repo: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || error.message,
      repo: null,
    };
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
      if (error instanceof AxiosError) {
        console.log(error.response?.data?.message);
      }
      throw error;
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
    if (error instanceof AxiosError) {
      console.log(error.response?.data?.message);
    }
    throw error;
  }
};

const deleteRepo = async (repoId: string): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${repoId}/delete`);

  try {
    await axios.delete(url.toString(), getAxiosConfig());
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      console.log(error.response?.data?.message);
    }
    throw error;
  }
};

export { addUser, deleteUser, getRepos, getRepo, addRepo, deleteRepo };
