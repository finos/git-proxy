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

import React, { useEffect, useRef } from 'react';
import { Banner, IconButton } from '@primer/react';
import type { BannerProps } from '@primer/react';
import { XIcon } from '@primer/octicons-react';

export const DEFAULT_TIMED_BANNER_MS = 5000;

export interface TimedBannerProps {
  open: boolean;
  onDismiss: () => void;
  autoHideMs?: number;
  title: React.ReactNode;
  description?: React.ReactNode;
  variant?: BannerProps['variant'];
  className?: string;
  dismissLabel?: string;
}

export default function TimedBanner({
  open,
  onDismiss,
  autoHideMs = DEFAULT_TIMED_BANNER_MS,
  title,
  description,
  variant = 'success',
  className = 'max-w-xl',
  dismissLabel = 'Dismiss notification',
}: TimedBannerProps): React.ReactElement | null {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!open) {
      return;
    }
    const id = setTimeout(() => {
      onDismissRef.current();
    }, autoHideMs);
    return () => clearTimeout(id);
  }, [open, autoHideMs]);

  if (!open) {
    return null;
  }

  return (
    <div className={`relative ${className}`.trim()}>
      <IconButton
        className='!absolute top-2 right-2 z-10'
        icon={XIcon}
        variant='invisible'
        aria-label={dismissLabel}
        unsafeDisableTooltip
        onClick={() => onDismissRef.current()}
      />
      <Banner variant={variant} layout='compact' className='pr-10'>
        <Banner.Title>{title}</Banner.Title>
        {description != null && description !== '' ? (
          <Banner.Description>{description}</Banner.Description>
        ) : null}
      </Banner>
    </div>
  );
}
