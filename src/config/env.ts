export type ServerConfig = {
  GIT_PROXY_SERVER_PORT: string | number;
  GIT_PROXY_HTTPS_SERVER_PORT: string | number;
  GIT_PROXY_UI_HOST: string;
  GIT_PROXY_UI_PORT: string | number;
};

const {
  GIT_PROXY_SERVER_PORT = 8000,
  GIT_PROXY_HTTPS_SERVER_PORT = 8443,
  GIT_PROXY_UI_HOST = 'http://localhost',
  GIT_PROXY_UI_PORT = 8080,
} = process.env;

export const serverConfig: ServerConfig = {
  GIT_PROXY_SERVER_PORT,
  GIT_PROXY_HTTPS_SERVER_PORT,
  GIT_PROXY_UI_HOST,
  GIT_PROXY_UI_PORT,
};
