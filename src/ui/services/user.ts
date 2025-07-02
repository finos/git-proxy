import axios, { AxiosError, AxiosResponse } from 'axios';
import { getCookie } from '../utils';
import { UserData } from '../../types/models';

type SetStateCallback<T> = (value: T | ((prevValue: T) => T)) => void;

const baseUrl: string = process.env.VITE_API_URI || location.origin;

const config = {
  withCredentials: true,
};

const getUser = async (
  setIsLoading?: SetStateCallback<boolean>,
  setData?: (userData: UserData) => void,
  setAuth?: SetStateCallback<boolean>,
  setIsError?: SetStateCallback<boolean>,
  id: string | null = null,
): Promise<void> => {
  let url = `${baseUrl}/api/auth/profile`;
  if (id) {
    url = `${baseUrl}/api/v1/user/${id}`;
  }
  console.log(url);

  try {
    const response: AxiosResponse<UserData> = await axios(url, config);
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
  setIsError: SetStateCallback<boolean>,
  setErrorMessage: SetStateCallback<string>,
  query: Record<string, string> = {},
): Promise<void> => {
  const url = new URL(`${baseUrl}/api/v1/user`);
  url.search = new URLSearchParams(query).toString();

  setIsLoading(true);

  try {
    const response: AxiosResponse<UserData[]> = await axios(url.toString(), {
      withCredentials: true,
    });
    setData(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        setAuth(false);
        setErrorMessage(
          'Failed to authorize user. If JWT auth is enabled, please check your configuration or disable it.',
        );
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
  const url = new URL(`${baseUrl}/api/auth/gitAccount`);

  try {
    await axios.post(url.toString(), data, {
      withCredentials: true,
      headers: { 'X-CSRF-TOKEN': getCookie('csrf') },
    });
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
  const url = new URL(`${baseUrl}/api/auth/me`);

  try {
    const response: AxiosResponse<UserData> = await axios(url.toString(), {
      withCredentials: true,
    });
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
