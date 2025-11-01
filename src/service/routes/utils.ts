interface User extends Express.User {
  username: string;
  admin?: boolean;
}

export function isAdminUser(user?: Express.User): user is User & { admin: true } {
  return user !== null && user !== undefined && (user as User).admin === true;
}
