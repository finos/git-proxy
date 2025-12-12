import axios, { AxiosError } from 'axios';
import { getAxiosConfig, processAuthError } from './auth';
import { API_BASE } from '../apiBase';
import { Action, Step } from '../../proxy/actions';
import { BackendResponse, PushActionView } from '../types';

const API_V1_BASE = `${API_BASE}/api/v1`;

const getPush = async (
  id: string,
  setIsLoading: (isLoading: boolean) => void,
  setPush: (push: PushActionView) => void,
  setAuth: (auth: boolean) => void,
  setIsError: (isError: boolean) => void,
): Promise<void> => {
  const url = `${API_V1_BASE}/push/${id}`;
  setIsLoading(true);

  await axios<Action>(url, getAxiosConfig())
    .then((response) => {
      const data: Action & { diff?: Step } = response.data;
      data.diff = data.steps.find((x: Step) => x.stepName === 'diff');
      setPush(data as PushActionView);
    })
    .catch((error: AxiosError<string>) => {
      if (error.response?.status === 401) setAuth(false);
      else setIsError(true);
    })
    .finally(() => {
      setIsLoading(false);
    });
};

const getPushes = async (
  setIsLoading: (isLoading: boolean) => void,
  setPushes: (pushes: PushActionView[]) => void,
  setAuth: (auth: boolean) => void,
  setIsError: (isError: boolean) => void,
  setErrorMessage: (errorMessage: string) => void,
  query = {
    blocked: true,
    canceled: false,
    authorised: false,
    rejected: false,
  },
): Promise<void> => {
  const url = new URL(`${API_V1_BASE}/push`);

  const stringifiedQuery = Object.fromEntries(
    Object.entries(query).map(([key, value]) => [key, value.toString()]),
  );
  url.search = new URLSearchParams(stringifiedQuery).toString();

  setIsLoading(true);

  await axios<Action[]>(url.toString(), getAxiosConfig())
    .then((response) => {
      setPushes(response.data as PushActionView[]);
    })
    .catch((error: AxiosError<BackendResponse>) => {
      setIsError(true);
      if (error.response?.status === 401) {
        setAuth(false);
        setErrorMessage(processAuthError(error));
      } else {
        const message = error.response?.data?.message ?? error.message;
        setErrorMessage(`Error fetching pushes: ${message}`);
      }
    })
    .finally(() => {
      setIsLoading(false);
    });
};

const authorisePush = async (
  id: string,
  setMessage: (message: string) => void,
  setUserAllowedToApprove: (userAllowedToApprove: boolean) => void,
  attestation: Array<{ label: string; checked: boolean }>,
): Promise<void> => {
  const url = `${API_V1_BASE}/push/${id}/authorise`;
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
    .catch((error: AxiosError<BackendResponse>) => {
      if (error.response && error.response.status === 401) {
        errorMsg = 'You are not authorised to approve...';
        isUserAllowedToApprove = false;
      }
    });
  setMessage(errorMsg);
  setUserAllowedToApprove(isUserAllowedToApprove);
};

const rejectPush = async (
  id: string,
  setMessage: (message: string) => void,
  setUserAllowedToReject: (userAllowedToReject: boolean) => void,
): Promise<void> => {
  const url = `${API_V1_BASE}/push/${id}/reject`;
  let errorMsg = '';
  let isUserAllowedToReject = true;
  await axios.post(url, {}, getAxiosConfig()).catch((error: AxiosError<BackendResponse>) => {
    if (error.response && error.response.status === 401) {
      errorMsg = 'You are not authorised to reject...';
      isUserAllowedToReject = false;
    }
  });
  setMessage(errorMsg);
  setUserAllowedToReject(isUserAllowedToReject);
};

const cancelPush = async (
  id: string,
  setAuth: (auth: boolean) => void,
  setIsError: (isError: boolean) => void,
): Promise<void> => {
  const url = `${API_BASE}/push/${id}/cancel`;
  await axios.post(url, {}, getAxiosConfig()).catch((error: AxiosError<BackendResponse>) => {
    if (error.response && error.response.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }
  });
};

export { getPush, getPushes, authorisePush, rejectPush, cancelPush };
