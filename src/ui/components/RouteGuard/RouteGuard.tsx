/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import { Navigate } from 'react-router';
import { Spinner, Text } from '@primer/react';
import { useAuth } from '../../auth/AuthProvider';

interface RouteGuardProps {
  component: React.ComponentType;
  adminOnly?: boolean;
}

const RouteGuard = ({ component: Component, adminOnly = false }: RouteGuardProps) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className='flex w-full min-w-0 items-center gap-2'>
        <Spinner />
        <Text>Loading…</Text>
      </div>
    );
  }

  if (!user) {
    return <Navigate to='/login' />;
  }

  if (user.mustChangePassword) {
    return <Navigate to='/login' />;
  }

  if (adminOnly && !user.admin) {
    return <Navigate to='/not-authorized' />;
  }

  return <Component />;
};

export default RouteGuard;
