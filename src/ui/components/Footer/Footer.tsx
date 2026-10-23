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
import { Text } from '@primer/react';
import { MarkGithubIcon } from '@primer/octicons-react';

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className='bg-white'>
      <div className='mt-4 border-t border-gray-900/10 pt-4 md:flex md:items-center md:justify-between'>
        <div className='flex gap-x-6 md:order-2'>
          <a
            href='https://github.com/finos/git-proxy'
            target='_blank'
            rel='noopener noreferrer'
            className='gitproxy-footer-icon-link inline-flex items-center justify-center'
            aria-label='GitProxy on GitHub'
          >
            <MarkGithubIcon size={16} aria-hidden />
          </a>
        </div>
        <Text as='span' size='medium'>
          &copy; {year} GitProxy. All rights reserved.
        </Text>
      </div>
    </footer>
  );
};

export default Footer;
