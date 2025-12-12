import { createContext } from 'react';
import { PublicUser } from '../db/types';

export const UserContext = createContext<UserContextType>({
  user: {
    admin: false,
  },
});

export interface UserContextType {
  user: {
    admin: boolean;
  };
}

export interface AuthContextType {
  user: PublicUser | null;
  setUser: React.Dispatch<React.SetStateAction<PublicUser | null>>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
