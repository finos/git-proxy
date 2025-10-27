import axios, { AxiosError, AxiosResponse } from 'axios';
import { getAxiosConfig, processAuthError } from './auth';
import { UserData } from '../../types/models';

import { API_BASE } from '../apiBase';

type SetStateCallback<T> = (value: T | ((prevValue: T) => T)) => void;

const getUser = async (
  setIsLoading?: SetStateCallback<boolean>,
  setData?: (userData: UserData) => void,
  setAuth?: SetStateCallback<boolean>,
  setIsError?: SetStateCallback<boolean>,
  id: string | null = null,
): Promise<void> => {
  let url = `${API_BASE}/api/auth/profile`;
  if (id) {
    url = `${API_BASE}/api/v1/user/${id}`;
  }

  try {
    const response: AxiosResponse<UserData> = await axios(url, getAxiosConfig());
    const data = response.data;

    setData?.(data);
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
  setData: SetStateCallback<UserData[]>,
  setAuth: SetStateCallback<boolean>,
  setErrorMessage: SetStateCallback<string>,
): Promise<void> => {
  setIsLoading(true);

  try {
    const response: AxiosResponse<UserData[]> = await axios(
      `${API_BASE}/api/v1/user`,
      getAxiosConfig(),
    );
    setData(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        setAuth(false);
        setErrorMessage(processAuthError(error));
      } else {
        const msg = (error.response?.data as any)?.message ?? error.message;
        setErrorMessage(`Error fetching users: ${msg}`);
      }
    } else {
      setErrorMessage(`Error fetching users: ${(error as Error).message ?? 'Unknown error'}`);
    }
  } finally {
    setIsLoading(false);
  }
};

const updateUser = async (data: UserData): Promise<void> => {
  console.log(data);
  try {
    await axios.post(`${API_BASE}/api/auth/gitAccount`, data, getAxiosConfig());
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      console.log((axiosError.response.data as any).message);
    }
    throw error;
  }
};

export { getUser, getUsers, updateUser };
