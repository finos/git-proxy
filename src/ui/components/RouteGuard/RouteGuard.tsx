import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { getUIRouteAuth } from '../../services/config';
import CircularProgress from '@material-ui/core/CircularProgress';

interface RouteGuardProps {
  component: React.ComponentType<any>;
  fullRoutePath: string;
}

interface UIRouteAuth {
  enabled: boolean;
  rules: {
    pattern: string;
    adminOnly: boolean;
    loginRequired: boolean;
  }[];
}

const RouteGuard = ({ component: Component, fullRoutePath }: RouteGuardProps) => {
  const { user, isLoading } = useAuth();

  const [loginRequired, setLoginRequired] = useState(false);
  const [adminOnly, setAdminOnly] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    getUIRouteAuth((uiRouteAuth: UIRouteAuth) => {
      if (uiRouteAuth?.enabled) {
        for (const rule of uiRouteAuth.rules) {
          if (new RegExp(rule.pattern).test(fullRoutePath)) {
            // Allow multiple rules to be applied according to route precedence
            // Ex: /dashboard/admin/* will override /dashboard/*
            setLoginRequired(loginRequired || rule.loginRequired);
            setAdminOnly(adminOnly || rule.adminOnly);
          }
        }
      }
      setAuthChecked(true);
    });
  }, [fullRoutePath]);

  if (!authChecked || isLoading) {
    return <CircularProgress />;
  }

  if (loginRequired && !user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !user?.admin) {
    return <Navigate to="/not-authorized" />;
  }

  return <Component />;
};

export default RouteGuard;
