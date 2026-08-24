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
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/20/solid';

export interface WarningProps {
  /** When empty or whitespace-only, nothing is rendered. */
  message: string;
  className?: string;
  /** Default: error styling. `success` uses green panel (e.g. confirmation after an action). */
  variant?: 'success';
  'data-testid'?: string;
}

const Warning = ({ message, className, variant, 'data-testid': dataTestId }: WarningProps) => {
  const text = message.trim();
  if (!text) {
    return null;
  }

  const isSuccess = variant === 'success';

  return (
    <div
      className={clsx('rounded-md p-4', isSuccess ? 'bg-green-50' : 'bg-red-50', className)}
      data-testid={dataTestId}
    >
      <div className='flex'>
        <div className='shrink-0'>
          {isSuccess ? (
            <CheckCircleIcon aria-hidden='true' className='size-5 text-green-500' />
          ) : (
            <XCircleIcon aria-hidden='true' className='size-5 text-red-400' />
          )}
        </div>
        <div className='ml-3'>
          <div className={isSuccess ? 'text-green-800' : 'text-red-700'}>{text}</div>
        </div>
      </div>
    </div>
  );
};

export default Warning;
