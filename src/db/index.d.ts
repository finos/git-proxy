import { User } from './types';

export function findUser(username: string): Promise<User | null>;
export function findUserBySSHKey(sshKey: string): Promise<User | null>;
