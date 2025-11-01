import { createContext } from 'react';
import { UserContextType } from './ui/types';

export const UserContext = createContext<UserContextType>({
  user: {
    admin: false,
  },
});
