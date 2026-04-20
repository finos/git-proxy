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

import React, { useState } from 'react';
import { ActionMenu, IconButton, Text } from '@primer/react';
import { CheckIcon, CodeIcon, CopyIcon, TerminalIcon } from '@primer/octicons-react';

/** Git-style green (matches common "Code" affordance). */
const codeButtonGreenClassName =
  '!border-0 !shadow-none !bg-[#1a7f37] !text-white hover:!bg-[#136c2e] hover:!text-white active:!bg-[#115f2a]';

interface CodeActionButtonProps {
  cloneURL: string;
}

const CodeActionButton = ({ cloneURL }: CodeActionButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyCloneUrl = (): void => {
    void navigator.clipboard.writeText(cloneURL);
    setIsCopied(true);
  };

  return (
    <ActionMenu onOpenChange={(open: boolean) => open && setIsCopied(false)}>
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
          <div className='flex items-center gap-2 font-semibold text-sm text-[var(--fgColor-default)]'>
            <TerminalIcon size='small' />
            Clone
          </div>
          <div className='flex min-h-[2rem] items-center gap-1 rounded-md border border-[var(--borderColor-default)] bg-[var(--bgColor-muted)] px-2 py-1.5 text-xs'>
            <span className='min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono'>
              {cloneURL}
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
          <Text as='p' size='small' className='m-0 text-[var(--fgColor-muted)]'>
            Clone using the git URL.
          </Text>
        </div>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
};

export default CodeActionButton;
