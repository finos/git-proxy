import axios, { AxiosError, AxiosResponse } from 'axios';
import { getAxiosConfig, processAuthError } from './auth';
import { PublicUser } from '../../db/types';
import { getBaseUrl, getApiV1BaseUrl } from './apiConfig';
import { getServiceError, formatErrorMessage } from './errors';

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
    const { status, message } = getServiceError(error, 'Unknown error');
    if (status === 401) {
      setAuth?.(false);
      setErrorMessage?.(processAuthError(error as AxiosError));
    } else {
      setErrorMessage?.(formatErrorMessage('Error fetching user', status, message));
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
    const { status, message } = getServiceError(error, 'Unknown error');
    if (status === 401) {
      setAuth(false);
      setErrorMessage(processAuthError(error as AxiosError));
    } else {
      setErrorMessage(formatErrorMessage('Error fetching users', status, message));
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
    const { status, message } = getServiceError(error, 'Unknown error');
    setErrorMessage(formatErrorMessage('Error updating user', status, message));
    setIsLoading(false);
  }
};

export { getUser, getUsers, updateUser };
