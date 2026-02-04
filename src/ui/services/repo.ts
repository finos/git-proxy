import axios, { AxiosError } from 'axios';
import { getAxiosConfig, processAuthError } from './auth.js';
import { Repo } from '../../db/types';
import { BackendResponse, RepoView } from '../types';
import { getApiV1BaseUrl } from './apiConfig';

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
    .catch((error: AxiosError<BackendResponse>) => {
      throw error;
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
  query: Record<string, string> = {},
): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo`);
  url.search = new URLSearchParams(query).toString();

  setIsLoading(true);
  await axios<RepoView[]>(url.toString(), getAxiosConfig())
    .then((response) => {
      const sortedRepos = response.data.sort((a: RepoView, b: RepoView) =>
        a.name.localeCompare(b.name),
      );
      setRepos(sortedRepos);
    })
    .catch((error: AxiosError<BackendResponse>) => {
      setIsError(true);
      if (error.response && error.response.status === 401) {
        setAuth(false);
        setErrorMessage(processAuthError(error));
      } else {
        setErrorMessage(`Error fetching repos: ${error.response?.data?.message ?? error.message}`);
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
    .catch((error: AxiosError) => {
      if (error.response && error.response.status === 401) {
        setAuth(false);
      } else {
        setIsError(true);
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
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        message: error.response?.data?.message ?? error.message,
        repo: null,
      };
    } else {
      throw error;
    }
  }
};

const addUser = async (repoId: string, user: string, action: string): Promise<void> => {
  const canAdd = await canAddUser(repoId, user, action);
  if (canAdd) {
    const apiV1Base = await getApiV1BaseUrl();
    const url = new URL(`${apiV1Base}/repo/${repoId}/user/${action}`);
    const data = { username: user };
    await axios.patch(url.toString(), data, getAxiosConfig()).catch((error: AxiosError<string>) => {
      throw error;
    });
  } else {
    console.log('Duplicate user can not be added');
    throw new DupUserValidationError('Duplicate user can not be added');
  }
};

const deleteUser = async (user: string, repoId: string, action: string): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${repoId}/user/${action}/${user}`);

  await axios.delete(url.toString(), getAxiosConfig()).catch((error: AxiosError<string>) => {
    throw error;
  });
};

const deleteRepo = async (repoId: string): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/repo/${repoId}/delete`);

  await axios.delete(url.toString(), getAxiosConfig()).catch((error: AxiosError<string>) => {
    throw error;
  });
};

export { addUser, deleteUser, getRepos, getRepo, addRepo, deleteRepo };
