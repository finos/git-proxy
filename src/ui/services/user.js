/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import axios from 'axios';
const baseUrl = 'http://localhost:8080';

const config = {
  withCredentials: true,
};

const getUser = async (setIsLoading, setData, setAuth, setIsError, id=null) => {
  let url = `${baseUrl}/auth/profile`;

  if (id) {
    url = `${baseUrl}/api/v1/user/${id}`;
  }

  console.log(url);

  await axios(url, config)
      .then((response) => {
        const data = response.data;
        setData(data);
        console.log(data);
        setIsLoading(false);
      })
      .catch((error) => {
        if (error.response && error.response.status === 401) setAuth(false);
        else setIsError(true);
        setIsLoading(false);
      });
};

const createUser = async (data) => {
  console.log(data);
  const url = new URL(`${baseUrl}/auth/profile`);
  await await axios.post(url, data, {withCredentials: true})
      .then(() => {
      })
      .catch((error) => {
        console.log(error.response.data.message);
        throw (error);
      });
};

const getUsers = async (setIsLoading, setData, setAuth, setIsError, query={}) => {
  const url = new URL(`${baseUrl}/api/v1/user`);
  url.search = new URLSearchParams(query);

  await axios(url.toString(), {withCredentials: true}).then((response) => {
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
  getUser,
  createUser,
  getUsers,
};
