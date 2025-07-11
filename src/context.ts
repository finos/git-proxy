import { createContext } from 'react';
import { UserContextType } from './ui/views/RepoDetails/RepoDetails';

export const UserContext = createContext<UserContextType>({
  user: {
    admin: false,
  },
});
