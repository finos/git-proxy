import axios from 'axios';
import { getAxiosConfig, processAuthError } from './auth.js';

const baseUrl = import.meta.env.VITE_API_URI
  ? `${import.meta.env.VITE_API_URI}`
  : `${location.origin}`;

const getUser = async (setIsLoading, setData, setAuth, setIsError, id = null) => {
  let url = `${baseUrl}/api/auth/profile`;

  if (id) {
    url = `${baseUrl}/api/v1/user/${id}`;
  }

  console.log(url);

  await axios(url, getAxiosConfig())
    .then((response) => {
      const data = response.data;
      if (setData) {
        setData(data);
      }
      if (setIsLoading) {
        setIsLoading(false);
      }
    })
    .catch((error) => {
      if (error.response && error.response.status === 401) {
        if (setAuth) {
          setAuth(false);
        }
      } else {
        if (setIsError) {
          setIsError(true);
        }
      }
      if (setIsLoading) {
        setIsLoading(false);
      }
    });
};

const getUsers = async (
  setIsLoading,
  setData,
  setAuth,
  setIsError,
  setErrorMessage,
  query = {},
) => {
  const url = new URL(`${baseUrl}/api/v1/user`);
  url.search = new URLSearchParams(query);
  setIsLoading(true);
  await axios(url.toString(), getAxiosConfig())
    .then((response) => {
      const data = response.data;
      setData(data);
    })
    .catch((error) => {
      setIsError(true);
      if (error.response && error.response.status === 401) {
        setAuth(false);
        setErrorMessage(processAuthError(error));
      } else {
        setErrorMessage(`Error fetching users: ${error.response.data.message}`);
      }
    }).finally(() => {
      setIsLoading(false);
    });
};

const updateUser = async (data) => {
  console.log(data);
  const url = new URL(`${baseUrl}/api/auth/gitAccount`);
  await axios
    .post(url, data, getAxiosConfig())
    .catch((error) => {
      console.log(error.response.data.message);
      throw error;
    });
};

const getUserLoggedIn = async (setIsLoading, setIsAdmin, setIsError, setAuth) => {
  const url = new URL(`${baseUrl}/api/auth/me`);

  await axios(url.toString(), getAxiosConfig())
    .then((response) => {
      const data = response.data;
      setIsLoading(false);
      setIsAdmin(data.admin);
    })
    .catch((error) => {
      setIsLoading(false);
      if (error.response && error.response.status === 401) {
        setAuth(false);
      } else {
        setIsError(true);
      }
      setIsLoading(false);
    });
};

export { getUser, getUsers, updateUser, getUserLoggedIn };
