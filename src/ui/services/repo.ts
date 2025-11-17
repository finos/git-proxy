import axios from 'axios';
import { getAxiosConfig, processAuthError } from './auth.js';
import { API_BASE } from '../apiBase';
import { Repo } from '../../db/types';
import { RepoView } from '../types';

const API_V1_BASE = `${API_BASE}/api/v1`;

const canAddUser = (repoId: string, user: string, action: string) => {
  const url = new URL(`${API_V1_BASE}/repo/${repoId}`);
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
  query: Record<string, boolean> = {},
): Promise<void> => {
  const url = new URL(`${API_V1_BASE}/repo`);
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
      if (error.response && error.response.status === 401) {
        setAuth(false);
        setErrorMessage(processAuthError(error));
      } else {
        setErrorMessage(`Error fetching repos: ${error.response.data.message}`);
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
  const url = new URL(`${API_V1_BASE}/repo/${id}`);
  setIsLoading(true);
  await axios<RepoView>(url.toString(), getAxiosConfig())
    .then((response) => {
      const repo = response.data;
      setRepo(repo);
    })
    .catch((error: any) => {
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
  const url = new URL(`${API_V1_BASE}/repo`);

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
    const url = new URL(`${API_V1_BASE}/repo/${repoId}/user/${action}`);
    const data = { username: user };
    await axios.patch(url.toString(), data, getAxiosConfig()).catch((error: any) => {
      console.log(error.response.data.message);
      throw error;
    });
  } else {
    console.log('Duplicate user can not be added');
    throw new DupUserValidationError('Duplicate user can not be added');
  }
};

const deleteUser = async (user: string, repoId: string, action: string): Promise<void> => {
  const url = new URL(`${API_V1_BASE}/repo/${repoId}/user/${action}/${user}`);

  await axios.delete(url.toString(), getAxiosConfig()).catch((error: any) => {
    console.log(error.response.data.message);
    throw error;
  });
};

const deleteRepo = async (repoId: string): Promise<void> => {
  const url = new URL(`${API_V1_BASE}/repo/${repoId}/delete`);

  await axios.delete(url.toString(), getAxiosConfig()).catch((error: any) => {
    console.log(error.response.data.message);
    throw error;
  });
};

export { addUser, deleteUser, getRepos, getRepo, addRepo, deleteRepo };
