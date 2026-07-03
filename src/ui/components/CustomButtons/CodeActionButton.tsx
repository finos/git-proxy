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

import React, { useState, useEffect } from 'react';
import { ActionMenu, IconButton, Text } from '@primer/react';
import { CheckIcon, CodeIcon, CopyIcon, TerminalIcon } from '@primer/octicons-react';
import { getSSHConfig, SSHConfig } from '../../services/ssh';

/** Git-style green (matches common "Code" affordance). */
const codeButtonGreenClassName =
  '!border-0 !shadow-none !bg-[#1a7f37] !text-white hover:!bg-[#136c2e] hover:!text-white active:!bg-[#115f2a]';

const tabActiveClassName =
  'border-b-2 border-[#fd8c73] font-semibold text-[var(--fgColor-default)]';
const tabInactiveClassName =
  'border-b-2 border-transparent text-[var(--fgColor-muted)] hover:text-[var(--fgColor-default)]';

interface CodeActionButtonProps {
  cloneURL: string;
}

const buildSSHUrl = (httpsUrl: string, config: SSHConfig): string => {
  try {
    const url = new URL(httpsUrl);
    const hostname = url.hostname;
    const path = url.pathname.substring(1);
    if (config.port !== 22) {
      return `ssh://git@${hostname}:${config.port}/${path}`;
    }
    return `git@${hostname}:${path}`;
  } catch {
    return '';
  }
};

const CodeActionButton = ({ cloneURL }: CodeActionButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'https' | 'ssh'>('https');
  const [sshConfig, setSshConfig] = useState<SSHConfig | null>(null);
  const [sshURL, setSSHURL] = useState('');

  useEffect(() => {
    getSSHConfig()
      .then((config) => {
        setSshConfig(config);
        if (config.enabled && cloneURL) {
          setSSHURL(buildSSHUrl(cloneURL, config));
        }
      })
      .catch(() => {});
  }, [cloneURL]);

  const currentURL = activeTab === 'https' ? cloneURL : sshURL;

  const copyCloneUrl = (): void => {
    void navigator.clipboard.writeText(currentURL);
    setIsCopied(true);
  };

  const sshEnabled = Boolean(sshConfig?.enabled && sshURL);

  return (
    <ActionMenu
      onOpenChange={(open: boolean) => {
        if (open) {
          setIsCopied(false);
          setActiveTab('https');
        }
      }}
    >
      <ActionMenu.Button
        variant='primary'
        size='small'
        leadingVisual={CodeIcon}
        className={`rounded-md font-semibold whitespace-nowrap ${codeButtonGreenClassName}`}
      >
        Code
      </ActionMenu.Button>
      <ActionMenu.Overlay
        width='auto'
        align='end'
        side='outside-bottom'
        displayInViewport
        className='!min-w-[300px] !max-w-[min(100vw-24px,450px)]'
      >
        <div className='flex flex-col gap-2 p-3'>
          {/* Tab bar — only shown when SSH is enabled */}
          {sshEnabled && (
            <div className='flex gap-4 border-b border-[var(--borderColor-default)] text-xs'>
              <button
                type='button'
                className={`pb-1.5 transition-colors ${activeTab === 'https' ? tabActiveClassName : tabInactiveClassName}`}
                onClick={() => {
                  setActiveTab('https');
                  setIsCopied(false);
                }}
              >
                HTTPS
              </button>
              <button
                type='button'
                className={`pb-1.5 transition-colors ${activeTab === 'ssh' ? tabActiveClassName : tabInactiveClassName}`}
                onClick={() => {
                  setActiveTab('ssh');
                  setIsCopied(false);
                }}
              >
                SSH
              </button>
            </div>
          )}

          {/* Clone header */}
          <div className='flex items-center gap-2 font-semibold text-sm text-[var(--fgColor-default)]'>
            <TerminalIcon size='small' />
            Clone
          </div>

          {/* URL + copy button */}
          <div className='flex min-h-[2rem] items-center gap-1 rounded-md border border-[var(--borderColor-default)] bg-[var(--bgColor-muted)] px-2 py-1.5 text-xs'>
            <span className='min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono'>
              {currentURL}
            </span>
            <IconButton
              data-testid='repo-url'
              icon={isCopied ? CheckIcon : CopyIcon}
              variant='invisible'
              aria-label={isCopied ? 'Copied to clipboard' : 'Copy URL to clipboard'}
              title={isCopied ? 'Copied to clipboard' : 'Copy URL to clipboard'}
              className={isCopied ? '!text-[#1a7f37]' : undefined}
              onClick={(event: React.MouseEvent) => {
                event.preventDefault();
                copyCloneUrl();
              }}
            />
          </div>

          {/* Description */}
          <Text as='p' size='small' className='m-0 text-[var(--fgColor-muted)]'>
            {activeTab === 'https'
              ? 'Clone using the web URL.'
              : 'Use a password-protected SSH key.'}
          </Text>
        </div>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
};

export default CodeActionButton;
