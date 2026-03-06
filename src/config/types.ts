import { GitProxyConfig } from './generated/config';

export type ServerConfig = {
  GIT_PROXY_SERVER_PORT: string | number;
  GIT_PROXY_HTTPS_SERVER_PORT: string | number;
  GIT_PROXY_UI_HOST: string;
  GIT_PROXY_UI_PORT: string | number;
  GIT_PROXY_HTTPS_UI_PORT: string | number;
  GIT_PROXY_COOKIE_SECRET: string | undefined;
  GIT_PROXY_MONGO_CONNECTION_STRING: string;
};

interface GitAuth {
  type: 'ssh';
  privateKeyPath: string;
}

interface HttpAuth {
  type: 'bearer';
  token: string;
}

interface BaseSource {
  type: 'file' | 'http' | 'git';
  enabled: boolean;
}

export interface FileSource extends BaseSource {
  type: 'file';
  path: string;
}

export interface HttpSource extends BaseSource {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  auth?: HttpAuth;
}

export interface GitSource extends BaseSource {
  type: 'git';
  repository: string;
  branch?: string;
  path: string;
  auth?: GitAuth;
}

export type ConfigurationSource = FileSource | HttpSource | GitSource;

interface ConfigurationSources {
  enabled: boolean;
  sources: ConfigurationSource[];
  reloadIntervalSeconds: number;
  merge?: boolean;
}

export interface Configuration extends GitProxyConfig {
  configurationSources?: ConfigurationSources;
}
