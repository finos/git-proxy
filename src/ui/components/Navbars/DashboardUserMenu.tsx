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

import React, { useContext } from 'react';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { ActionMenu, ActionList, IconButton } from '@primer/react';
import { PersonFillIcon } from '@primer/octicons-react';

import { UserContext } from '../../context';
import { getAxiosConfig } from '../../services/auth';
import { getBaseUrl } from '../../services/apiConfig';

const DashboardUserMenu = () => {
  const navigate = useNavigate();
  const { user } = useContext(UserContext);

  const goLogin = () => {
    navigate('/login', { replace: true });
  };

  const goProfile = () => {
    navigate('/dashboard/profile', { replace: true });
  };

  const logout = async () => {
    try {
      const baseUrl = await getBaseUrl();
      const { data } = await axios.post(`${baseUrl}/api/auth/logout`, {}, getAxiosConfig());

      if (!data.isAuth && !data.user) {
        navigate(0);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Logout failed:', msg);
    }
  };

  if (!user) {
    return (
      <button
        type='button'
        data-testid='dashboard-header-sign-in'
        onClick={goLogin}
        className='rounded-md border border-solid border-[rgba(240,246,252,0.35)] bg-black px-3 py-1 text-sm font-medium leading-normal text-[rgba(240,246,252,0.92)] antialiased [font-family:var(--fontStack-sansSerif)] hover:border-[rgba(240,246,252,0.5)] hover:bg-neutral-950 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--header-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--header-bgColor)]'
      >
        Sign in
      </button>
    );
  }

  return (
    <ActionMenu>
      <ActionMenu.Anchor>
        <IconButton
          icon={PersonFillIcon}
          variant='invisible'
          size='medium'
          aria-haspopup='menu'
          aria-label='Account menu'
          data-testid='dashboard-header-account-menu'
          className='!size-8 !min-h-8 !min-w-8 !max-w-8 !rounded-full !border-0 !p-0 !text-[var(--header-fgColor-default)] hover:!bg-white/10'
        />
      </ActionMenu.Anchor>
      <ActionMenu.Overlay width='auto' align='end' side='outside-bottom' displayInViewport>
        <ActionList>
          <ActionList.Item onSelect={goProfile}>My Account</ActionList.Item>
          <ActionList.Divider />
          <ActionList.Item variant='danger' onSelect={logout}>
            Logout
          </ActionList.Item>
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
};

export default DashboardUserMenu;
