import axios, { AxiosError, AxiosResponse } from 'axios';
import { getAxiosConfig, processAuthError } from './auth';
import { PublicUser } from '../../db/types';

import { API_BASE } from '../apiBase';

type SetStateCallback<T> = (value: T | ((prevValue: T) => T)) => void;

const getUser = async (
  setIsLoading?: SetStateCallback<boolean>,
  setUser?: (user: PublicUser) => void,
  setAuth?: SetStateCallback<boolean>,
  setIsError?: SetStateCallback<boolean>,
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
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 401) {
      setAuth?.(false);
    } else {
      setIsError?.(true);
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
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        setAuth(false);
        setErrorMessage(processAuthError(error));
      } else {
        const msg = error.response?.data?.message ?? error.message;
        setErrorMessage(`Error fetching users: ${msg}`);
      }
    } else {
      setErrorMessage(`Error fetching users: ${(error as Error).message ?? 'Unknown error'}`);
    }
  } finally {
    setIsLoading(false);
  }
};

const updateUser = async (user: PublicUser): Promise<void> => {
  console.log(user);
  try {
    await axios.post(`${API_BASE}/api/auth/gitAccount`, user, getAxiosConfig());
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.log(error.response?.data?.message);
    } else {
      console.log(`Error updating user: ${error}`);
    }
    throw error;
  }
};

export { getUser, getUsers, updateUser };
