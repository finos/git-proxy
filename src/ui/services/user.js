/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import axios from 'axios';
const baseUrl = 'http://localhost:8080';

const config = {
  withCredentials: true,
};

const getUser = async (setIsLoading, setData, setAuth, setIsError) => {
  const url = new URL(`${baseUrl}/auth/profile`);
  await axios(url.toString(), config)
      .then((response) => {
        const data = response.data;
        setData(data);
        setIsLoading(false);
      })
      .catch((error) => {
        if (error.response && error.response.status === 401) setAuth(false);
        else setIsError(true);
        setIsLoading(false);
      });
};

const createUser = async (data) => {
  const url = new URL(`${baseUrl}/auth/profile`);
  await await axios.post(url, data, {withCredentials: true})
      .then(() => {
      })
      .catch((error) => {
        console.log(error);
        console.log('----');
        console.log(error.response.data.message);
        console.log('----');
        throw (error);
      });
};

export {
  getUser,
  createUser,
};
