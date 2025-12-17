import axios, { AxiosError, AxiosResponse } from 'axios';
import { getAxiosConfig, processAuthError } from './auth';
import { PublicUser } from '../../db/types';

import { API_BASE } from '../apiBase';
import { BackendResponse } from '../types';

type SetStateCallback<T> = (value: T | ((prevValue: T) => T)) => void;

const getUser = async (
  setIsLoading?: SetStateCallback<boolean>,
  setUser?: (user: PublicUser) => void,
  setAuth?: SetStateCallback<boolean>,
  setErrorMessage?: SetStateCallback<string>,
  id: string | null = null,
): Promise<void> => {
  let url = `${API_BASE}/api/auth/profile`;
  if (id) {
    url = `${API_BASE}/api/v1/user/${id}`;
  }

  try {
    const response: AxiosResponse<PublicUser> = await axios(url, getAxiosConfig());
    const user = response.data;

    setUser?.(user);
    setIsLoading?.(false);
  } catch (error: unknown) {
    const axiosError = error as AxiosError<BackendResponse>;
    const status = axiosError.response?.status;
    if (status === 401) {
      setAuth?.(false);
      setErrorMessage?.(processAuthError(axiosError));
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMessage?.(`Error fetching user: ${msg}`);
    }
    setIsLoading?.(false);
  }
};

const getUsers = async (
  setIsLoading: SetStateCallback<boolean>,
  setUsers: SetStateCallback<PublicUser[]>,
  setAuth: SetStateCallback<boolean>,
  setErrorMessage: SetStateCallback<string>,
): Promise<void> => {
  setIsLoading(true);

  try {
    const response: AxiosResponse<PublicUser[]> = await axios(
      `${API_BASE}/api/v1/user`,
      getAxiosConfig(),
    );
    setUsers(response.data);
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 401) {
        setAuth(false);
        setErrorMessage(processAuthError(error));
      } else {
        const msg = error.response?.data?.message ?? error.message;
        setErrorMessage(`Error fetching users: ${status} ${msg}`);
      }
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMessage(`Error fetching users: ${msg}`);
    }
  } finally {
    setIsLoading(false);
  }
};

const updateUser = async (
  user: PublicUser,
  setErrorMessage: SetStateCallback<string>,
  setIsLoading: SetStateCallback<boolean>,
): Promise<void> => {
  try {
    await axios.post(`${API_BASE}/api/auth/gitAccount`, user, getAxiosConfig());
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      setErrorMessage(error.response?.data?.message);
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMessage(`Error updating user: ${msg}`);
    }
    setIsLoading(false);
  }
};

export { getUser, getUsers, updateUser };
