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

import React, { Component, ErrorInfo, PropsWithChildren, ReactNode, useState } from 'react';
import { Button, Label, Stack, Text } from '@primer/react';

const IS_DEV = process.env.NODE_ENV !== 'production';

const errorPanelClass =
  'max-w-[560px] w-full rounded-md border border-(--borderColor-default) border-l-4 border-l-(--borderColor-danger-emphasis) bg-(--bgColor-default) p-6 shadow-sm';

const ProdFallback = ({ reset }: { reset: () => void }) => {
  return (
    <div className='flex min-h-[60vh] items-center justify-center p-4'>
      <div className={errorPanelClass} role='alert'>
        <Text as='h2' className='m-0 mb-2 text-base font-semibold text-(--fgColor-danger)'>
          Something went wrong
        </Text>
        <Text as='p' className='m-0 mb-4 text-sm text-(--fgColor-muted)'>
          An unexpected error occurred. Please try again — if the problem persists, contact your
          administrator.
        </Text>
        <Stack direction='horizontal' gap='condensed' padding='none' align='center' wrap='wrap'>
          <Button variant='primary' size='small' onClick={reset}>
            Retry
          </Button>
          <Button variant='default' size='small' onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </Stack>
      </div>
    </div>
  );
};

const DevFallback = ({
  error,
  name,
  reset,
}: {
  error: Error;
  name?: string;
  reset: () => void;
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const context = name ? ` in ${name}` : '';

  return (
    <div className='flex min-h-[60vh] items-center justify-center p-4'>
      <div className={errorPanelClass} role='alert'>
        <Label variant='attention' size='small' className='mb-3'>
          dev
        </Label>
        <Text as='h2' className='m-0 mb-2 text-base font-semibold text-(--fgColor-danger)'>
          Something went wrong{context}
        </Text>
        <Text as='p' className='m-0 mb-4 text-sm whitespace-pre-wrap text-(--fgColor-default)'>
          {error.message}
        </Text>
        <Stack direction='horizontal' gap='condensed' padding='none' align='center' wrap='wrap'>
          <Button variant='primary' size='small' onClick={reset}>
            Retry
          </Button>
          {error.stack && (
            <Button variant='default' size='small' onClick={() => setShowDetails((v) => !v)}>
              {showDetails ? 'Hide stack trace' : 'Show stack trace'}
            </Button>
          )}
        </Stack>
        {error.stack && showDetails && (
          <pre className='mt-4 max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-(--borderColor-default) bg-(--bgColor-muted) p-4 font-mono text-xs text-(--fgColor-default)'>
            {error.stack}
          </pre>
        )}
      </div>
    </div>
  );
};

type Props = PropsWithChildren<{
  name?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}>;

type State = { error: Error | undefined };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: undefined };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    if (IS_DEV) {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }
  }

  reset = () => this.setState({ error: undefined });

  render() {
    const { error } = this.state;
    const { children, fallback, name } = this.props;

    if (error) {
      if (fallback) return fallback(error, this.reset);
      return IS_DEV ? (
        <DevFallback error={error} name={name} reset={this.reset} />
      ) : (
        <ProdFallback reset={this.reset} />
      );
    }

    return children;
  }
}
