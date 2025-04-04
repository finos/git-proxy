import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUserInfo } from '../services/auth';

// Interface for when we convert to TypeScript
// interface AuthContextType {
//   user: any;
//   setUser: (user: any) => void;
//   refreshUser: () => Promise<void>;
//   isLoading: boolean;
// }

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const data = await getUserInfo();
      setUser(data);
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
