import axios from 'axios';
import { getAxiosConfig, processAuthError } from './auth';
import { getApiV1BaseUrl } from './apiConfig';
import { Action, Step } from '../../proxy/actions';
import { PushActionView } from '../types';

interface PushActionResult {
  success: boolean;
  status?: number;
  message?: string;
}

const getActionErrorResult = (error: any, fallbackMessage: string): PushActionResult => {
  const status = error?.response?.status;
  const responseMessage = error?.response?.data?.message;
  const message =
    typeof responseMessage === 'string' && responseMessage.trim().length > 0
      ? responseMessage
      : error?.message || fallbackMessage;
  return {
    success: false,
    status,
    message,
  };
};

const getPush = async (
  id: string,
  setIsLoading: (isLoading: boolean) => void,
  setPush: (push: PushActionView) => void,
  setAuth: (auth: boolean) => void,
  setIsError: (isError: boolean) => void,
): Promise<void> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}`;
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
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/push`);
  url.search = new URLSearchParams(query as any).toString();

  setIsLoading(true);

  try {
    const response = await axios<Action[]>(url.toString(), getAxiosConfig());
    setPushes(response.data as PushActionView[]);
  } catch (error: any) {
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

const authorisePush = async (
  id: string,
  attestation: Array<{ label: string; checked: boolean }>,
): Promise<PushActionResult> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}/authorise`;

  try {
    await axios.post(
      url,
      {
        params: {
          attestation,
        },
      },
      getAxiosConfig(),
    );
    return { success: true };
  } catch (error: any) {
    return getActionErrorResult(error, 'Failed to approve push request');
  }
};

const rejectPush = async (id: string): Promise<PushActionResult> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}/reject`;

  try {
    await axios.post(url, {}, getAxiosConfig());
    return { success: true };
  } catch (error: any) {
    return getActionErrorResult(error, 'Failed to reject push request');
  }
};

const cancelPush = async (id: string): Promise<PushActionResult> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}/cancel`;

  try {
    await axios.post(url, {}, getAxiosConfig());
    return { success: true };
  } catch (error: any) {
    return getActionErrorResult(error, 'Failed to cancel push request');
  }
};

export { getPush, getPushes, authorisePush, rejectPush, cancelPush };
export type { PushActionResult };
