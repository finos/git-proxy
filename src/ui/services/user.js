/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import axios from 'axios';
const { logger, winstonLogger } = require('../../logging/index');
const { GIT_PROXY_UI_PORT: uiPort } = require('../../config/env').Vars;
const baseUrl = `http://localhost:${uiPort}/api/v1`;

const config = {
  withCredentials: true,
};

const getUser = async (
  setIsLoading,
  setData,
  setAuth,
  setIsError,
  id = null,
) => {
  let url = `${baseUrl}/auth/profile`;

  if (id) {
    url = `${baseUrl}/api/v1/user/${id}`;
  }

  logger.info(url);

  await axios(url, config)
    .then((response) => {
      const data = response.data;
      setData(data);
      winstonLogger('info', 'user.js', data);
      setIsLoading(false);
    })
    .catch((error) => {
      if (error.response && error.response.status === 401) setAuth(false);
      else setIsError(true);
      setIsLoading(false);
    });
};

const createUser = async (data) => {
  logger.info(data);
  const url = new URL(`${baseUrl}/auth/profile`);
  await axios
    .post(url, data, { withCredentials: true })
    .then(() => {})
    .catch((error) => {
      winstonLogger('error', 'user.js', error.response.data.message);
      throw error;
    });
};

const getUsers = async (
  setIsLoading,
  setData,
  setAuth,
  setIsError,
  query = {},
) => {
  const url = new URL(`${baseUrl}/api/v1/user`);
  url.search = new URLSearchParams(query);

  await axios(url.toString(), { withCredentials: true })
    .then((response) => {
      const data = response.data;
      setData(data);
      setIsLoading(false);
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

export { getUser, createUser, getUsers };
