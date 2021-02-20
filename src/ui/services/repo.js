/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import axios from 'axios';
const baseUrl = 'http://localhost:8080/api/v1';

const config = {
  withCredentials: true,
};


const getRepos = async (setIsLoading, setData, setAuth, setIsError, query={}) => {
  const url = new URL(`${baseUrl}/repo`);
  url.search = new URLSearchParams(query);

  await axios(url.toString(), config).then((response) => {
    const data = response.data;
    setData(data);
    setIsLoading(false);
  }).catch((error) => {
    setIsLoading(false);
    if (error.response && error.response.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }
    setIsLoading(false);
  });
};


const getRepo = async (setIsLoading, setData, setAuth, setIsError, id) => {
  const url = new URL(`${baseUrl}/repo/${id}`);
  await axios(url.toString(), config).then((response) => {
    const data = response.data;
    setData(data);
    setIsLoading(false);
  }).catch((error) => {
    setIsLoading(false);
    if (error.response && error.response.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }
    setIsLoading(false);
  });
};

const addUser = async (repoName, user, type) => {
  let action = '';
  if (type === 'canAuthorise') {
    action = 'authorise';
  } else if (type === 'canPush') {
    action = 'push';
  }

  const url = new URL(`${baseUrl}/repo/${repoName}/user/${action}`);
  const data = {username: user};
  await await axios.patch(url, data, {withCredentials: true})
      .then(() => {
      })
      .catch((error) => {
        console.log(error.response.data.message);
        throw (error);
      });
};

const deleteUser = async (user, repoName, action) => {
  console.log(data);
  const url = new URL(`${baseUrl}/repo/${repoName}`);
  await await axios.post(url, data, {withCredentials: true})
      .then(() => {
      })
      .catch((error) => {
        console.log(error.response.data.message);
        throw (error);
      });
};

export {
  addUser,
  deleteUser,
  getRepos,
  getRepo,
};
