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

import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router';
import Navbar from '../components/Navbars/Navbar';
import Footer from '../components/Footer/Footer';
import routes from '../../routes';
import logo from '../assets/img/git-proxy.png';
import { UserContext } from '../context';
import { getUser } from '../services/user';
import { Route as RouteType } from '../types';
import { PublicUser } from '../../db/types';
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import {
  dashboardColumnClass,
  dashboardColumnFullWidthClass,
  dashboardContentClass,
  dashboardMapClass,
  dashboardMainPanelClass,
  dashboardRoutesGrowClass,
  dashboardWrapperClass,
} from './dashboardLayout';

interface ActivitiesProps {
  [key: string]: unknown;
}

const App = ({ ...rest }: ActivitiesProps) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const { id } = useParams<{ id?: string }>();
  const { pathname } = useLocation();

  const switchRoutes = (
    <Routes>
      {routes.map((prop: RouteType, key: number) => {
        if (prop.layout === '/dashboard' && prop.component) {
          const Component = prop.component;
          return <Route path={prop.path} element={<Component />} key={key} />;
        }
        return null;
      })}
      <Route path='/dashboard' element={<Navigate to='/dashboard/repo' replace />} />
    </Routes>
  );

  useEffect(() => {
    void getUser(undefined, setUser);
  }, [id]);

  const isMapRoute = () => window.location.pathname === '/dashboard/maps';

  const hasFullPageWidth = pathname.startsWith('/dashboard/push/');
  const dashboardColumnClassResolved = hasFullPageWidth
    ? dashboardColumnFullWidthClass
    : dashboardColumnClass;

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <div className={dashboardWrapperClass}>
        <Navbar routes={routes} logo={logo} {...rest} />
        <div className={dashboardMainPanelClass}>
          <ErrorBoundary name='Activities'>
            {isMapRoute() ? (
              <div className={dashboardMapClass}>{switchRoutes}</div>
            ) : (
              <div className={dashboardContentClass}>
                <div className={dashboardColumnClassResolved}>
                  <div className={dashboardRoutesGrowClass}>{switchRoutes}</div>
                  <Footer />
                </div>
              </div>
            )}
          </ErrorBoundary>
        </div>
      </div>
    </UserContext.Provider>
  );
};

export default App;
