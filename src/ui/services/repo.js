import axios from 'axios';
import { getCookie } from '../utils.jsx';

const baseUrl = import.meta.env.VITE_API_URI
  ? `${import.meta.env.VITE_API_URI}/api/v1`
  : `${location.origin}/api/v1`;

const config = {
  withCredentials: true,
};

const canAddUser = (repoId, user, action) => {
  const url = new URL(`${baseUrl}/repo/${repoId}`);
  return axios
    .get(url.toString(), config)
    .then((response) => {
      const data = response.data;
      if (action === 'authorise') {
        return !data.users.canAuthorise.includes(user);
      } else {
        return !data.users.canPush.includes(user);
      }
    })
    .catch((error) => {
      throw error;
    });
};

class DupUserValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'The user already has this role...';
  }
}

const getRepos = async (
  setIsLoading,
  setData,
  setAuth,
  setIsError,
  setErrorMessage,
  query = {},
) => {
  const url = new URL(`${baseUrl}/repo`);
  url.search = new URLSearchParams(query);
  setIsLoading(true);
  await axios(url.toString(), config)
    .then((response) => {
      const data = response.data;
      setData(data);
    })
    .catch((error) => {
      setIsError(true);
      if (error.response && error.response.status === 401) {
        setAuth(false);
        setErrorMessage(
          'Failed to authorize user. If JWT auth is enabled, please check your configuration or disable it.',
        );
      } else {
        setErrorMessage(`Error fetching repositories: ${error.response.data.message}`);
      }
    })
    .finally(() => {
      setIsLoading(false);
    });
};

const getRepo = async (setIsLoading, setData, setAuth, setIsError, id) => {
  const url = new URL(`${baseUrl}/repo/${id}`);
  setIsLoading(true);
  await axios(url.toString(), config)
    .then((response) => {
      const data = response.data;
      setData(data);
    })
    .catch((error) => {
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

const addRepo = async (onClose, setError, data) => {
  const url = new URL(`${baseUrl}/repo`);
  return axios
    .post(url, data, { withCredentials: true, headers: { 'X-CSRF-TOKEN': getCookie('csrf') } })
    .then((response) => {
      onClose();
      return response.data;
    })
    .catch((error) => {
      console.log(error.response.data.message);
      setError(error.response.data.message);
    });
};

const addUser = async (repoId, user, action) => {
  const canAdd = await canAddUser(repoId, user, action);
  if (canAdd) {
    const url = new URL(`${baseUrl}/repo/${repoId}/user/${action}`);
    const data = { username: user };
    await axios
      .patch(url, data, { withCredentials: true, headers: { 'X-CSRF-TOKEN': getCookie('csrf') } })
      .catch((error) => {
        console.log(error.response.data.message);
        throw error;
      });
  } else {
    console.log('Duplicate user can not be added');
    throw new DupUserValidationError();
  }
};

const deleteUser = async (user, repoId, action) => {
  const url = new URL(`${baseUrl}/repo/${repoId}/user/${action}/${user}`);

  await axios
    .delete(url, { withCredentials: true, headers: { 'X-CSRF-TOKEN': getCookie('csrf') } })
    .catch((error) => {
      console.log(error.response.data.message);
      throw error;
    });
};

const deleteRepo = async (repoId) => {
  const url = new URL(`${baseUrl}/repo/${repoId}/delete`);

  await axios
    .delete(url, { withCredentials: true, headers: { 'X-CSRF-TOKEN': getCookie('csrf') } })
    .catch((error) => {
      console.log(error.response.data.message);
      throw error;
    });
};

export { addUser, deleteUser, getRepos, getRepo, addRepo, deleteRepo };
