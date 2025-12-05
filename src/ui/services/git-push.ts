import axios from 'axios';
import { getAxiosConfig, processAuthError } from './auth';
import { API_BASE } from '../apiBase';
import { Action, Step } from '../../proxy/actions';
import { PushActionView } from '../types';

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

  try {
    const response = await axios<Action>(url, getAxiosConfig());
    const data: Action & { diff?: Step } = response.data;
    data.diff = data.steps.find((x: Step) => x.stepName === 'diff');
    setPush(data as PushActionView);
  } catch (error: any) {
    if (error.response?.status === 401) setAuth(false);
    else setIsError(true);
  } finally {
    setIsLoading(false);
  }
};

const getPushes = async (
  query = {
    blocked: true,
    canceled: false,
    authorised: false,
    rejected: false,
  },
): Promise<PushActionView[]> => {
  const url = new URL(`${API_V1_BASE}/push`);
  url.search = new URLSearchParams(query as any).toString();

  const response = await axios<Action[]>(url.toString(), getAxiosConfig());
  return response.data as PushActionView[];
};

const authorisePush = async (
  id: string,
  setMessage: (message: string) => void,
  attestation: Array<{ label: string; checked: boolean }>,
): Promise<boolean> => {
  const url = `${API_V1_BASE}/push/${id}/authorise`;
  let errorMsg = '';
  let success = true;
  await axios.post(url, { params: { attestation } }, getAxiosConfig()).catch((error: any) => {
    if (error.response && error.response.status === 401) {
      errorMsg = 'You are not authorised to approve...';
      success = false;
    }
  });
  setMessage(errorMsg);
  return success;
};

const rejectPush = async (
  id: string,
  setMessage: (message: string) => void,
  rejection: { reason: string },
): Promise<boolean> => {
  const url = `${API_V1_BASE}/push/${id}/reject`;
  let errorMsg = '';
  let success = true;
  await axios.post(url, { params: rejection }, getAxiosConfig()).catch((error: any) => {
    if (error.response && error.response.status === 401) {
      errorMsg = 'You are not authorised to reject...';
      success = false;
    }
  });
  setMessage(errorMsg);
  return success;
};

const cancelPush = async (
  id: string,
  setAuth: (auth: boolean) => void,
  setIsError: (isError: boolean) => void,
): Promise<void> => {
  const url = `${API_BASE}/push/${id}/cancel`;
  await axios.post(url, {}, getAxiosConfig()).catch((error: any) => {
    if (error.response && error.response.status === 401) {
      setAuth(false);
    } else {
      setIsError(true);
    }
  });
};

export { getPush, getPushes, authorisePush, rejectPush, cancelPush };
