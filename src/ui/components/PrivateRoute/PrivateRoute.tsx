import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

const PrivateRoute = ({ component: Component, adminOnly = false }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div>Loading...</div>; // TODO: Add loading spinner
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !user.admin) {
    return <Navigate to="/not-authorized" />;
  }

  return <Component />;
};

export default PrivateRoute;
