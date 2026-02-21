import axios from 'axios';
import { getAxiosConfig } from './auth';
import { getApiV1BaseUrl } from './apiConfig';
import { Action, Step } from '../../proxy/actions';
import { PushActionView } from '../types';
import { ServiceResult, errorResult, successResult } from './errors';

const getPush = async (id: string): Promise<ServiceResult<PushActionView>> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}`;

  try {
    const response = await axios<Action>(url, getAxiosConfig());
    const data: Action = response.data;
    const actionView: PushActionView = {
      ...data,
      diff: data.steps.find((x: Step) => x.stepName === 'diff')!,
    };
    return successResult(actionView);
  } catch (error: any) {
    return errorResult(error, 'Failed to load push');
  }
};

const getPushes = async (
  query = {
    blocked: true,
    canceled: false,
    authorised: false,
    rejected: false,
  },
): Promise<ServiceResult<PushActionView[]>> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/push`);
  url.search = new URLSearchParams(query as any).toString();

  try {
    const response = await axios<Action[]>(url.toString(), getAxiosConfig());
    return successResult(response.data as unknown as PushActionView[]);
  } catch (error: any) {
    return errorResult(error, 'Failed to load pushes');
  }
};

const authorisePush = async (
  id: string,
  attestation: Array<{ label: string; checked: boolean }>,
): Promise<ServiceResult> => {
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
    return successResult();
  } catch (error: any) {
    return errorResult(error, 'Failed to approve push request');
  }
};

const rejectPush = async (id: string): Promise<ServiceResult> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}/reject`;

  try {
    await axios.post(url, {}, getAxiosConfig());
    return successResult();
  } catch (error: any) {
    return errorResult(error, 'Failed to reject push request');
  }
};

const cancelPush = async (id: string): Promise<ServiceResult> => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = `${apiV1Base}/push/${id}/cancel`;

  try {
    await axios.post(url, {}, getAxiosConfig());
    return successResult();
  } catch (error: any) {
    return errorResult(error, 'Failed to cancel push request');
  }
};

export { getPush, getPushes, authorisePush, rejectPush, cancelPush };
