import axios from 'axios';
import { getAxiosConfig, processAuthError } from './auth.js';
import { getApiBaseUrl } from './runtime-config.js';

// Initialize baseUrl - will be set async
let baseUrl = `${location.origin}/api/v1`; // Default fallback

// Set the actual baseUrl from runtime config
getApiBaseUrl()
  .then((apiUrl) => {
    baseUrl = `${apiUrl}/api/v1`;
  })
  .catch(() => {
    // Keep the default if runtime config fails
    console.warn('Using default API base URL for git-push');
  });

  const getPush = async (id, setIsLoading, setData, setAuth, setIsError) => {
    const url = `${baseUrl}/push/${id}`;
    setIsLoading(true);

    try {
      const response = await axios(url, getAxiosConfig());
      const data = response.data;
      data.diff = data.steps.find((x) => x.stepName === 'diff');
      setData(data);
    } catch (error) {
      if (error.response?.status === 401) setAuth(false);
      else setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

const getPushes = async (
  setIsLoading,
  setData,
  setAuth,
  setIsError,
  setErrorMessage,
  query = {
    blocked: true,
    canceled: false,
    authorised: false,
    rejected: false,
  }
) => {
  const url = new URL(`${baseUrl}/push`);
  url.search = new URLSearchParams(query);

  setIsLoading(true);

  try {
    const response = await axios(url.toString(), getAxiosConfig());
    setData(response.data);
  } catch (error) {
    setIsError(true);

    if (error.response?.status === 401) {
      setAuth(false);
      setErrorMessage(processAuthError(error));
    } else {
      const message = error.response?.data?.message || error.message;
      setErrorMessage(`Error fetching pushes: ${message}`);
    }
  } finally {
    setIsLoading(false);
  }
};

const authorisePush = async (id, setMessage, setUserAllowedToApprove, attestation) => {
  const url = `${baseUrl}/push/${id}/authorise`;
  let errorMsg = '';
  let isUserAllowedToApprove = true;
  await axios
    .post(
      url,
      {
        params: {
          attestation,
        },
      },
      getAxiosConfig(),
    )
    .catch((error) => {
      if (error.response && error.response.status === 401) {
        errorMsg = 'You are not authorised to approve...';
        isUserAllowedToApprove = false;
      }
    });
  await setMessage(errorMsg);
  await setUserAllowedToApprove(isUserAllowedToApprove);
};

const rejectPush = async (id, setMessage, setUserAllowedToReject) => {
  const url = `${baseUrl}/push/${id}/reject`;
  let errorMsg = '';
  let isUserAllowedToReject = true;
  await axios
    .post(url, {}, getAxiosConfig())
    .catch((error) => {
      if (error.response && error.response.status === 401) {
        errorMsg = 'You are not authorised to reject...';
        isUserAllowedToReject = false;
      }
    });
  await setMessage(errorMsg);
  await setUserAllowedToReject(isUserAllowedToReject);
};

const cancelPush = async (id, setAuth, setIsError) => {
  const url = `${baseUrl}/push/${id}/cancel`;
  await axios
    .post(url, {}, getAxiosConfig())
    .catch((error) => {
      if (error.response && error.response.status === 401) {
        setAuth(false);
      } else {
        setIsError(true);
      }
    });
};

export { getPush, getPushes, authorisePush, rejectPush, cancelPush };
