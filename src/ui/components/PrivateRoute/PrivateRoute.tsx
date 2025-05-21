import React from 'react';
import CircularProgress from '@material-ui/core/CircularProgress';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';

const PrivateRoute = ({ component: Component, adminOnly = false }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <CircularProgress />;
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
