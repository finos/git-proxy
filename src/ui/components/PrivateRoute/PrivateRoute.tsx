import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

const PrivateRoute = ({ component: Component, adminOnly = false }) => {
  const { user, isLoading } = useAuth();
  console.debug('PrivateRoute', { user, isLoading, adminOnly });

  if (isLoading) {
    console.debug('Auth is loading, waiting');
    return <div>Loading...</div>; // TODO: Add loading spinner
  }

  if (!user) {
    console.debug('User not logged in, redirecting to login page');
    return <Navigate to="/login" />;
  }

  if (adminOnly && !user.admin) {
    console.debug('User is not an admin, redirecting to not authorized page');
    return <Navigate to="/not-authorized" />;
  }

  return <Component />;
};

export default PrivateRoute;
