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


const getRepo = async (setIsLoading, setData, setAuth, setIsError) => {
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

export {
  getRepos,
  getRepo,
};
