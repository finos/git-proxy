import axios from 'axios';
import { QuestionFormData } from '../types';
import { UIRouteAuth } from '../../config/generated/config';
import { getApiV1BaseUrl } from './apiConfig';

const setAttestationConfigData = async (setData: (data: QuestionFormData[]) => void) => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/config/attestation`);
  await axios(url.toString()).then((response) => {
    setData(response.data.questions);
  });
};

const setURLShortenerData = async (setData: (data: string) => void) => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/config/urlShortener`);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

const setEmailContactData = async (setData: (data: string) => void) => {
  const apiV1Base = await getApiV1BaseUrl();
  const url = new URL(`${apiV1Base}/config/contactEmail`);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

const setUIRouteAuthData = async (setData: (data: UIRouteAuth) => void) => {
  const apiV1Base = await getApiV1BaseUrl();
  const urlString = `${apiV1Base}/config/uiRouteAuth`;
  console.log(`URL: ${urlString}`);
  const url = new URL(urlString);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

export { setAttestationConfigData, setURLShortenerData, setEmailContactData, setUIRouteAuthData };
