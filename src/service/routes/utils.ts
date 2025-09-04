interface User {
  username: string;
  admin?: boolean;
}

export function isAdminUser(user: any): user is User & { admin: true } {
  return typeof user === 'object' && user !== null && (user as User).admin === true;
}
