import axios from 'axios';

const baseUrl = import.meta.env.VITE_API_URI
  ? `${import.meta.env.VITE_API_URI}/api/v1`
  : `${location.origin}/api/v1`;

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

const getSSHConfig = async (setData) => {
  const url = new URL(`${baseUrl}/config/ssh`);
  await axios(url.toString(), { withCredentials: true })
    .then((response) => {
      const { enabled = true, port = 22 } = response.data ?? {};
      setData({ enabled, port });
    })
    .catch((err) => {
      console.error('Failed to load SSH config:', err);
      setData({ enabled: true, port: 22 });
    });
};

export { getAttestationConfig, getURLShortener, getEmailContact, getUIRouteAuth, getSSHConfig };
