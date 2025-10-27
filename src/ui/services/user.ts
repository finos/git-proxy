import axios, { AxiosError, AxiosResponse } from 'axios';
import { getAxiosConfig, processAuthError } from './auth';
import { PublicUser } from '../../db/types';
import { getBaseUrl, getApiV1BaseUrl } from './apiConfig';

type SetStateCallback<T> = (value: T | ((prevValue: T) => T)) => void;

const getUser = async (
  setIsLoading?: SetStateCallback<boolean>,
  setUser?: (user: PublicUser) => void,
  setAuth?: SetStateCallback<boolean>,
  setErrorMessage?: SetStateCallback<string>,
  id: string | null = null,
): Promise<void> => {
  const baseUrl = await getBaseUrl();
  const apiV1BaseUrl = await getApiV1BaseUrl();

  let url = `${baseUrl}/api/auth/profile`;
  if (id) {
    url = `${apiV1BaseUrl}/user/${id}`;
  }

  try {
    const response: AxiosResponse<PublicUser> = await axios(url, getAxiosConfig());
    const user = response.data;

    setUser?.(user);
    setIsLoading?.(false);
  } catch (error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    if (status === 401) {
      setAuth?.(false);
      setErrorMessage?.(processAuthError(axiosError));
    } else {
      const msg = (axiosError.response?.data as any)?.message ?? 'Unknown error';
      setErrorMessage?.(`Error fetching user: ${status} ${msg}`);
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
    const apiV1BaseUrl = await getApiV1BaseUrl();
    const response: AxiosResponse<PublicUser[]> = await axios(
      `${apiV1BaseUrl}/user`,
      getAxiosConfig(),
    );
    setUsers(response.data);
  } catch (error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    if (status === 401) {
      setAuth(false);
      setErrorMessage(processAuthError(axiosError));
    } else {
      const msg = (axiosError.response?.data as any)?.message ?? 'Unknown error';
      setErrorMessage(`Error fetching users: ${status} ${msg}`);
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
    const baseUrl = await getBaseUrl();
    await axios.post(`${baseUrl}/api/auth/gitAccount`, user, getAxiosConfig());
  } catch (error) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const msg = (axiosError.response?.data as any)?.message ?? 'Unknown error';
    setErrorMessage(`Error updating user: ${status} ${msg}`);
    setIsLoading(false);
  }
};

const getUserLoggedIn = async (
  setIsLoading: SetStateCallback<boolean>,
  setIsAdmin: SetStateCallback<boolean>,
  setIsError: SetStateCallback<boolean>,
  setAuth: SetStateCallback<boolean>,
): Promise<void> => {
  try {
    const baseUrl = await getBaseUrl();
    const response: AxiosResponse<UserData> = await axios(
      `${baseUrl}/api/auth/me`,
      getAxiosConfig(),
    );
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
