import axios from 'axios';
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
    console.warn('Using default API base URL for config');
  });

const getAttestationConfig = async (setData) => {
  const url = new URL(`${baseUrl}/config/attestation`);
  await axios(url.toString()).then((response) => {
    setData(response.data.questions);
  });
};

const getURLShortener = async (setData) => {
  const url = new URL(`${baseUrl}/config/urlShortener`);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

const getEmailContact = async (setData) => {
  const url = new URL(`${baseUrl}/config/contactEmail`);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

const getUIRouteAuth = async (setData) => {
  const url = new URL(`${baseUrl}/config/uiRouteAuth`);
  await axios(url.toString()).then((response) => {
    setData(response.data);
  });
};

export { getAttestationConfig, getURLShortener, getEmailContact, getUIRouteAuth };
