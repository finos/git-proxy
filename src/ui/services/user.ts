import axios, { AxiosError, AxiosResponse } from 'axios';
import { getAxiosConfig, processAuthError } from './auth';
import { UserData } from '../../types/models';
import { baseApiUrl } from '../utils';

type SetStateCallback<T> = (value: T | ((prevValue: T) => T)) => void;

const getUser = async (
  setIsLoading?: SetStateCallback<boolean>,
  setData?: (userData: UserData) => void,
  setAuth?: SetStateCallback<boolean>,
  setIsError?: SetStateCallback<boolean>,
  id: string | null = null,
): Promise<void> => {
  let url = `${baseApiUrl}/api/auth/profile`;
  if (id) {
    url = `${baseApiUrl}/api/v1/user/${id}`;
  }
  console.log(url);

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
  query: Record<string, string> = {},
): Promise<void> => {
  const url = new URL(`${baseApiUrl}/api/v1/user`);
  url.search = new URLSearchParams(query).toString();

  setIsLoading(true);

  try {
    const response: AxiosResponse<UserData[]> = await axios(url.toString(), getAxiosConfig());
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
  const url = new URL(`${baseApiUrl}/api/auth/gitAccount`);

  try {
    await axios.post(url.toString(), data, getAxiosConfig());
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      console.log((axiosError.response.data as any).message);
    }
    throw error;
  }
};

const getUserLoggedIn = async (
  setIsLoading: SetStateCallback<boolean>,
  setIsAdmin: SetStateCallback<boolean>,
  setIsError: SetStateCallback<boolean>,
  setAuth: SetStateCallback<boolean>,
): Promise<void> => {
  const url = new URL(`${baseApiUrl}/api/auth/me`);

  try {
    const response: AxiosResponse<UserData> = await axios(url.toString(), getAxiosConfig());
    const data = response.data;
    setIsLoading(false);
    setIsAdmin(data.admin || false);
  } catch (error) {
    setIsLoading(false);
    const axiosError = error as AxiosError;
    if (axiosError.response?.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }
  }
};

export { getUser, getUsers, updateUser, getUserLoggedIn };
