import { PublicUser, User as DbUser } from '../../db/types';

interface User extends Express.User {
  username: string;
  admin?: boolean;
}

export function isAdminUser(user?: Express.User): user is User & { admin: true } {
  return user !== null && user !== undefined && (user as User).admin === true;
}

export const toPublicUser = (user: DbUser): PublicUser => {
  return {
    username: user.username || '',
    displayName: user.displayName || '',
    email: user.email || '',
    title: user.title || '',
    gitAccount: user.gitAccount || '',
    admin: user.admin || false,
  };
};
