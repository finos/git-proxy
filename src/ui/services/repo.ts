import axios from 'axios';
import { getAxiosConfig, processAuthError } from './auth.js';
import { Repo } from '../../db/types';
import { RepoView } from '../types';
import { getApiV1BaseUrl } from './apiConfig';

interface ServiceError {
  status?: number;
  message: string;
}

const getServiceError = (error: any, fallbackMessage: string): ServiceError => {
  const status = error?.response?.status;
  const responseMessage = error?.response?.data?.message;
  const message =
    typeof responseMessage === 'string' && responseMessage.trim().length > 0
      ? responseMessage
      : error?.message || fallbackMessage;
  return { status, message };
};

const formatErrorMessage = (prefix: string, status: number | undefined, message: string): string =>
  `${prefix}: ${status ? `${status} ` : ''}${message}`;

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
  await axios<RepoView[]>(url.toString(), getAxiosConfig())
    .then((response) => {
      const sortedRepos = response.data.sort((a: RepoView, b: RepoView) =>
        a.name.localeCompare(b.name),
      );
      setRepos(sortedRepos);
    })
    .catch((error: any) => {
      setIsError(true);
      const { status, message } = getServiceError(error, 'Unknown error');
      if (status === 401) {
        setAuth(false);
        setErrorMessage(processAuthError(error));
      } else {
        setErrorMessage(formatErrorMessage('Error fetching repos', status, message));
      }
    })
    .finally(() => {
      setIsLoading(false);
    });
};

const getRepo = async (
  setIsLoading: (isLoading: boolean) => void,
  setRepo: (repo: RepoView) => void,
  setAuth: (auth: boolean) => void,
  setIsError: (isError: boolean) => void,
  setErrorMessage: (errorMessage: string) => void,
  id: string,
): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${id}`);
  setIsLoading(true);
  await axios<RepoView>(url.toString(), getAxiosConfig())
    .then((response) => {
      const repo = response.data;
      setRepo(repo);
    })
    .catch((error: any) => {
      const { status, message } = getServiceError(error, 'Unknown error');
      setIsError(true);
      if (status === 401) {
        setAuth(false);
        setErrorMessage(processAuthError(error));
      } else {
        setErrorMessage(formatErrorMessage('Error fetching repo', status, message));
      }
    })
    .finally(() => {
      setIsLoading(false);
    });
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
    const { message } = getServiceError(error, 'Failed to add repository');
    return {
      success: false,
      message,
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
