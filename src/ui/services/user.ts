import axios, { AxiosError, AxiosResponse } from 'axios';
import { getAxiosConfig, processAuthError } from './auth';
import { PublicUser } from '../../db/types';
import { BackendResponse } from '../types';
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
    const apiV1BaseUrl = await getApiV1BaseUrl();
    const response: AxiosResponse<PublicUser[]> = await axios(
      `${apiV1BaseUrl}/user`,
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
    const baseUrl = await getBaseUrl();
    await axios.post(`${baseUrl}/api/auth/gitAccount`, user, getAxiosConfig());
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const msg = error.response?.data?.message;
      setErrorMessage(`Error updating user: ${status} ${msg}`);
    } else {
      const msg = error instanceof Error ? error.message : String(error);
      setErrorMessage(`Error updating user: ${msg}`);
    }
    setIsLoading(false);
  }
};

export { getUser, getUsers, updateUser };
