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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import { IconButton } from '@primer/react';
import { SlidersIcon } from '@primer/octicons-react';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import DashboardUserMenu from './DashboardUserMenu';
import { Route } from '../../types';

interface HeaderProps {
  routes: Route[];
  logo: string;
  logoAlt?: string;
}

function navHref(route: Route): string {
  return `${route.layout}${route.path}`;
}

function dashboardNavSlug(routeName: string): string {
  return routeName.toLowerCase().replace(/\s+/g, '-');
}

/** Match github.com global header: 14px / medium (500) / Primer UI sans stack */
const navLinkTypography =
  'text-sm font-medium leading-normal antialiased [font-family:var(--fontStack-sansSerif)]';

const mobileMenuLinkBase = `block rounded-md px-3 py-2 ${navLinkTypography}`;

/** Dashboard navbar row is `h-16` (4rem); logo stays below this for vertical breathing room. */
const LOGO_MAX_HEIGHT_PX = 50;
/** Rendered logo = this fraction of the image file's intrinsic pixel size (capped to `LOGO_MAX_HEIGHT_PX`). */
const LOGO_FRACTION_OF_INTRINSIC = 0.64;

function logoDisplayFromIntrinsic(
  naturalW: number,
  naturalH: number,
): { width: number; height: number } {
  let w = naturalW * LOGO_FRACTION_OF_INTRINSIC;
  let h = naturalH * LOGO_FRACTION_OF_INTRINSIC;
  if (h > LOGO_MAX_HEIGHT_PX) {
    const scale = LOGO_MAX_HEIGHT_PX / h;
    w *= scale;
    h = LOGO_MAX_HEIGHT_PX;
  }
  return { width: w, height: h };
}

const Header = ({ routes, logo, logoAlt = 'GitProxy' }: HeaderProps) => {
  const visible = routes.filter((r) => r.layout === '/dashboard' && r.visible);
  const [logoPx, setLogoPx] = useState<{ width: number; height: number } | null>(null);
  const logoImgRef = useRef<HTMLImageElement>(null);

  const applyLogoIntrinsicSize = useCallback((img: HTMLImageElement) => {
    const { naturalWidth: nw, naturalHeight: nh } = img;
    if (!nw || !nh) return;
    setLogoPx(logoDisplayFromIntrinsic(nw, nh));
  }, []);

  useEffect(() => {
    setLogoPx(null);
    const el = logoImgRef.current;
    if (el?.complete && el.naturalWidth) {
      applyLogoIntrinsicSize(el);
    }
  }, [logo, applyLogoIntrinsicSize]);

  const onLogoLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      applyLogoIntrinsicSize(e.currentTarget);
    },
    [applyLogoIntrinsicSize],
  );

  return (
    <nav
      data-testid='dashboard-header'
      className='gitproxy-navbar relative z-10 overflow-visible bg-gray-900 font-medium antialiased [font-family:var(--fontStack-sansSerif)]'
      aria-label='Dashboard'
    >
      <Disclosure as='div'>
        {({ close }) => (
          <>
            <div className='mx-auto max-w-7xl px-2 sm:px-6 lg:px-8'>
              <div className='relative flex h-16 items-center justify-between overflow-visible'>
                <div className='absolute inset-y-0 left-0 flex items-center sm:hidden'>
                  <DisclosureButton
                    className={({ open }) =>
                      clsx(
                        'group relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-[rgba(255,255,255,0.88)] hover:bg-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-white/60',
                        open && 'bg-white/10',
                      )
                    }
                  >
                    <span className='sr-only'>Open main menu</span>
                    <Bars3Icon className='block size-5 group-data-open:hidden' aria-hidden='true' />
                    <XMarkIcon className='hidden size-5 group-data-open:block' aria-hidden='true' />
                  </DisclosureButton>
                </div>
                <div className='flex min-h-0 flex-1 items-center justify-center sm:justify-start'>
                  <div className='relative z-[1] flex h-16 shrink-0 items-center justify-center overflow-visible'>
                    <NavLink to='/dashboard/repo' aria-label='Home'>
                      <img
                        ref={logoImgRef}
                        src={logo}
                        alt={logoAlt}
                        onLoad={onLogoLoad}
                        className='block object-contain'
                        style={
                          logoPx
                            ? { width: logoPx.width, height: logoPx.height }
                            : { width: 36, height: 36, opacity: 0.25 }
                        }
                      />
                    </NavLink>
                  </div>
                  <div
                    data-testid='dashboard-header-nav-desktop'
                    className='hidden min-h-0 items-center sm:ml-6 sm:flex'
                  >
                    <div className='flex items-center gap-4'>
                      {visible.map((item) => (
                        <NavLink
                          key={item.name}
                          data-testid={`dashboard-nav-desktop-${dashboardNavSlug(item.name)}`}
                          to={navHref(item)}
                          className={({ isActive }) =>
                            clsx(
                              'rounded-md px-3 py-2',
                              navLinkTypography,
                              isActive
                                ? 'gitproxy-navbar-link--active bg-white/15'
                                : 'hover:bg-white/[0.08]',
                            )
                          }
                          style={({ isActive }) => ({
                            // Sync with `.gitproxy-navbar a` in tailwind.css (stylesheet uses !important).
                            color: isActive ? 'rgb(255, 255, 255)' : 'rgba(240, 246, 252, 0.82)',
                          })}
                        >
                          {item.name}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </div>

                <div className='absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0'>
                  <div className='hidden sm:contents'>
                    <IconButton
                      icon={SlidersIcon}
                      variant='invisible'
                      size='medium'
                      aria-label='Settings'
                      data-testid='dashboard-header-settings'
                      data-header-settings
                      {...({
                        as: NavLink,
                        to: '/dashboard/admin/settings',
                        end: true,
                      } as Record<string, unknown>)}
                      className='relative rounded-full p-1 focus:outline-2 focus:-outline-offset-2 focus:outline-white/60'
                      style={{ color: 'rgba(240, 246, 252, 0.82)' }}
                    />
                  </div>
                  <div className='relative ml-3'>
                    <DashboardUserMenu />
                  </div>
                </div>
              </div>
            </div>

            <DisclosurePanel className='sm:hidden'>
              <div data-testid='dashboard-header-nav-mobile' className='space-y-1 px-2 pt-2 pb-3'>
                {visible.map((item) => (
                  <NavLink
                    key={item.name}
                    data-testid={`dashboard-nav-mobile-${dashboardNavSlug(item.name)}`}
                    to={navHref(item)}
                    onClick={() => close()}
                    className={({ isActive }) =>
                      clsx(
                        mobileMenuLinkBase,
                        isActive
                          ? 'gitproxy-navbar-link--active bg-white/15'
                          : 'hover:bg-white/[0.08]',
                      )
                    }
                    style={({ isActive }) => ({
                      color: isActive ? 'rgb(255, 255, 255)' : 'rgba(240, 246, 252, 0.82)',
                    })}
                  >
                    {item.name}
                  </NavLink>
                ))}
                <NavLink
                  data-testid='dashboard-nav-mobile-settings'
                  to='/dashboard/admin/settings'
                  end
                  onClick={() => close()}
                  className={({ isActive }) =>
                    clsx(
                      mobileMenuLinkBase,
                      isActive
                        ? 'gitproxy-navbar-link--active bg-white/15'
                        : 'hover:bg-white/[0.08]',
                    )
                  }
                  style={({ isActive }) => ({
                    color: isActive ? 'rgb(255, 255, 255)' : 'rgba(240, 246, 252, 0.82)',
                  })}
                >
                  Settings
                </NavLink>
              </div>
            </DisclosurePanel>
          </>
        )}
      </Disclosure>
    </nav>
  );
};

export default Header;
