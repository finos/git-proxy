import { User } from '../../db/types';

export const toPublicUser = (user: User) => {
  return {
    username: user.username || '',
    displayName: user.displayName || '',
    email: user.email || '',
    title: user.title || '',
    gitAccount: user.gitAccount || '',
    admin: user.admin || false,
  };
};
