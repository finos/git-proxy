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
import {
  UnderlinePanels as PrimerUnderlinePanels,
  type UnderlinePanelsProps,
} from '@primer/react/experimental';
import { GITPROXY_PRIMER_UNDERLINE_TAB_STRIP_CLASS } from './gitProxyUnderlineTabStripClass';

const GitProxyUnderlinePanels = (props: UnderlinePanelsProps): React.ReactElement => {
  const { className, ...rest } = props;
  return (
    <PrimerUnderlinePanels
      className={clsx(GITPROXY_PRIMER_UNDERLINE_TAB_STRIP_CLASS, className)}
      {...rest}
    />
  );
};

GitProxyUnderlinePanels.Tab = PrimerUnderlinePanels.Tab;
GitProxyUnderlinePanels.Panel = PrimerUnderlinePanels.Panel;

export default GitProxyUnderlinePanels;
export { GitProxyUnderlinePanels };
