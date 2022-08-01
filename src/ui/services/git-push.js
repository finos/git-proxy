/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import axios from 'axios';

// const baseUrl = `${process.env.REACT_APP_API_URI}/api/v1`;
const baseUrl = `${location.origin}/api/v1`;

const config = {
  withCredentials: true,
};

const getUser = async (setIsLoading, setData, setAuth, setIsError) => {
  const url = new URL(`${location.origin}/api/auth/success`);
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

const getPush = async (id, setIsLoading, setData, setAuth, setIsError) => {
  const url = new URL(`${baseUrl}/push/${id}`);
  await axios(url.toString(), config)
    .then((response) => {
      const data = response.data;
      data.diff = data.steps.find((x) => x.stepName === 'diff');
      setData(data);
      setIsLoading(false);
    })
    .catch((error) => {
      if (error.response && error.response.status === 401) setAuth(false);
      else setIsError(true);
      setIsLoading(false);
    });
};

const getPushes = async (setIsLoading, setData, setAuth, setIsError, query={blocked: true, canceled: false, authorised: false, rejected: false}) => {
  const url = new URL(`${baseUrl}/push`);
  url.search = new URLSearchParams(query);

  setIsLoading(true);
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

const authorisePush = async (id, setMessage, setUserAllowedToApprove) => {
  const url = `${baseUrl}/push/${id}/authorise`;
  let errorMsg='';
  let isUserAllowedToApprove = true;
  await axios.post(url, {}, {withCredentials: true}).then(() => {
  }).catch((error) => {
    if (error.response && error.response.status === 401) {
      errorMsg = 'you are not authorised to approve pull requests';
      isUserAllowedToApprove = false;
   }
  });
  await setMessage(errorMsg);
  await setUserAllowedToApprove(isUserAllowedToApprove);
};

const rejectPush = async (id, setAuth, setIsError) => {
  const url = `${baseUrl}/push/${id}/reject`;
  await axios.post(url, {}, {withCredentials: true}).then(() => {
  }).catch((error) => {
    if (error.response && error.response.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }
  });
};

const cancelPush = async (id, setAuth, setIsError) => {
  const url = `${baseUrl}/push/${id}/cancel`;
  await axios.post(url, {}, {withCredentials: true}).then((response) => {
  }).catch((error) => {
    if (error.response && error.response.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }
  });
};

export {
  getPush,
  getPushes,
  authorisePush,
  rejectPush,
  cancelPush,
  getUser,
};
