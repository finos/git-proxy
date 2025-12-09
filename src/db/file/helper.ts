import { existsSync, mkdirSync } from 'fs';

export const getSessionStore = (): undefined => undefined;
export const initializeFolders = () => {
  if (!existsSync('./.data')) mkdirSync('./.data');
  if (!existsSync('./.data/db')) mkdirSync('./.data/db');
};
