/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import axios from 'axios';

// const baseUrl = `${process.env.REACT_APP_API_URI}/api/v1`;
const baseUrl = `${location.origin}/api/v1`;

const config = {
  withCredentials: true,
};

const canAddUser = (repoName, user, action) => {
  const url = new URL(`${baseUrl}/repo/${repoName}`);
  return axios.get(url.toString(), config).then((response) => {
    const data = response.data;
    if (action == 'authorise') {
      return !data.users.canAuthorise.includes(user);
    } else {
      return !data.users.canPush.includes(user);
    }
  }).catch((error) => {
    throw (error);
  });
};

class DupUserValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'The user alread has this role';
  }
}

const getRepos = async (setIsLoading, setData, setAuth, setIsError, query={}) => {
  const url = new URL(`${baseUrl}/repo`);
  url.search = new URLSearchParams(query);
  setIsLoading(true);
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
  setIsLoading(true);
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

const addRepo = async (onClose, setError, data) => {
  const url = new URL( `${baseUrl}/repo` );
  axios.post(url, data, {withCredentials: true}).then((response) => {
     onClose();
  }).catch((error)=>{
     console.log(error.response.data.message);
     setError(error.response.data.message);
   });
};

const addUser = async (repoName, user, action) => {
  // check whether current repo meets the max user limitation
  const canAdd = await canAddUser(repoName, user, action);
  if (canAdd == true) {
    const url = new URL(`${baseUrl}/repo/${repoName}/user/${action}`);
    const data = {username: user};
    await axios.patch(url, data, {withCredentials: true})
        .then(() => {
        })
        .catch((error) => {
          console.log(error.response.data.message);
          throw (error);
        });
  } else {
    console.log('Duplicate user can not be added');
    throw new DupUserValidationError();
  }
};

const deleteUser = async (user, repoName, action) => {
  const url = new URL(`${baseUrl}/repo/${repoName}/user/${action}/${user}`);

  await axios.delete(url, {withCredentials: true})
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
    addRepo,
};
