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
import clsx from 'clsx';
import { UnderlineNav as PrimerUnderlineNav, type UnderlineNavProps } from '@primer/react';
import { GITPROXY_PRIMER_UNDERLINE_TAB_STRIP_CLASS } from './gitProxyUnderlineTabStripClass';

const GitProxyUnderlineNavRoot = React.forwardRef<unknown, UnderlineNavProps>(
  function GitProxyUnderlineNav(props, ref) {
    const { className, ...rest } = props;
    return (
      <PrimerUnderlineNav
        ref={ref}
        className={clsx(GITPROXY_PRIMER_UNDERLINE_TAB_STRIP_CLASS, className)}
        {...rest}
      />
    );
  },
);

GitProxyUnderlineNavRoot.displayName = 'GitProxyUnderlineNav';

/** Same API as Primer `UnderlineNav` with shared GitProxy tab strip L&F. */
export const GitProxyUnderlineNav = Object.assign(GitProxyUnderlineNavRoot, {
  Item: PrimerUnderlineNav.Item,
}) as typeof PrimerUnderlineNav;

export default GitProxyUnderlineNav;
