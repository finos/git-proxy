import { ServerConfig } from './types';

const {
  GIT_PROXY_SERVER_PORT = 8000,
  GIT_PROXY_HTTPS_SERVER_PORT = 8443,
  GIT_PROXY_UI_HOST = 'http://localhost',
  GIT_PROXY_UI_PORT = 8080,
  GIT_PROXY_COOKIE_SECRET,
  GIT_PROXY_MONGO_CONNECTION_STRING = 'mongodb://localhost:27017/git-proxy',
} = process.env;

export const serverConfig: ServerConfig = {
  GIT_PROXY_SERVER_PORT,
  GIT_PROXY_HTTPS_SERVER_PORT,
  GIT_PROXY_UI_HOST,
  GIT_PROXY_UI_PORT,
  GIT_PROXY_COOKIE_SECRET,
  GIT_PROXY_MONGO_CONNECTION_STRING,
};
