import axios from 'axios';
import { API_BASE } from '../apiBase';
import { FormQuestion } from '../views/PushDetails/components/AttestationForm';
import { UIRouteAuth } from '../../config/generated/config';

const API_V1_BASE = `${API_BASE}/api/v1`;

const setAttestationConfigData = async (setData: (data: FormQuestion[]) => void) => {
  const url = new URL(`${API_V1_BASE}/config/attestation`);
  await axios(url.toString()).then((response) => {
    setData(response.data.questions);
  });
};

const setURLShortenerData = async (setData: (data: string) => void) => {
  const url = new URL(`${API_V1_BASE}/config/urlShortener`);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

const setEmailContactData = async (setData: (data: string) => void) => {
  const url = new URL(`${API_V1_BASE}/config/contactEmail`);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

const setUIRouteAuthData = async (setData: (data: UIRouteAuth) => void) => {
  const url = new URL(`${API_V1_BASE}/config/uiRouteAuth`);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

export { setAttestationConfigData, setURLShortenerData, setEmailContactData, setUIRouteAuthData };
