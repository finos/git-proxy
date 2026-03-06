import { existsSync, mkdirSync } from 'fs';

export const getSessionStore = (): undefined => undefined;
export const initializeFolders = () => {
  if (!existsSync('./.data/db')) mkdirSync('./.data/db', { recursive: true });
};
