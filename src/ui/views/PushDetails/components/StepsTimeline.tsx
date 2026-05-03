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
import { Label, Text, Timeline } from '@primer/react';
import {
  CheckCircleIcon,
  AlertIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@primer/octicons-react';
import { StepData } from '../../../../proxy/actions/Step';

interface StepsTimelineProps {
  steps: StepData[];
}

function StepIcon({ step }: { step: StepData }): React.ReactElement {
  if (step.error) {
    return <XCircleIcon size={16} className='text-(--fgColor-danger)' />;
  }
  if (step.blocked) {
    return <AlertIcon size={16} className='text-(--fgColor-attention)' />;
  }
  return <CheckCircleIcon size={16} className='text-(--fgColor-success)' />;
}

function StepStatusLabel({ step }: { step: StepData }): React.ReactElement {
  if (step.error) {
    return (
      <Label variant='danger' size='small'>
        Error
      </Label>
    );
  }
  if (step.blocked) {
    return (
      <Label variant='attention' size='small'>
        Blocked
      </Label>
    );
  }
  return (
    <Label variant='success' size='small'>
      Success
    </Label>
  );
}

interface StepRowProps {
  step: StepData;
  expanded: boolean;
  onToggle: () => void;
}

function StepRow({ step, expanded, onToggle }: StepRowProps): React.ReactElement {
  const isLarge = step.stepName === 'writePack' || step.stepName === 'diff';
  const hasDetails =
    !isLarge && (step.error || step.blocked || step.content || (step.logs && step.logs.length > 0));

  return (
    <Timeline.Item key={step.id} className='py-0.5! first:pt-0! last:pb-0!'>
      <Timeline.Badge className='!bg-(--bgColor-default) !shadow-none'>
        <StepIcon step={step} />
      </Timeline.Badge>
      <Timeline.Body className='min-w-0 pb-2'>
        <div className='min-w-0'>
          <button
            type='button'
            onClick={hasDetails ? onToggle : undefined}
            disabled={!hasDetails}
            className='flex w-full min-w-0 cursor-default items-center gap-2 rounded-sm text-left disabled:cursor-default'
            aria-expanded={hasDetails ? expanded : undefined}
          >
            {hasDetails ? (
              expanded ? (
                <ChevronDownIcon size={14} className='shrink-0 text-(--fgColor-muted)' />
              ) : (
                <ChevronRightIcon size={14} className='shrink-0 text-(--fgColor-muted)' />
              )
            ) : (
              <span className='w-[14px] shrink-0' aria-hidden />
            )}
            <code className='min-w-0 truncate font-mono text-sm font-medium text-(--fgColor-default)'>
              {step.stepName}
            </code>
            <StepStatusLabel step={step} />
          </button>

          {hasDetails && expanded && (
            <div className='mt-2 ml-5 min-w-0 space-y-2'>
              {step.error && step.errorMessage && (
                <div className='min-w-0 rounded-md border border-(--borderColor-danger-emphasis) bg-(--bgColor-danger-muted) px-3 py-2'>
                  <Text as='p' className='m-0 text-xs font-semibold text-(--fgColor-danger)'>
                    Error
                  </Text>
                  <Text
                    as='p'
                    className='mt-1 mb-0 font-mono text-xs whitespace-pre-wrap break-words text-(--fgColor-default)'
                  >
                    {step.errorMessage}
                  </Text>
                </div>
              )}
              {step.blocked && step.blockedMessage && (
                <div className='min-w-0 rounded-md border border-(--borderColor-attention-emphasis) bg-(--bgColor-attention-muted) px-3 py-2'>
                  <Text as='p' className='m-0 text-xs font-semibold text-(--fgColor-attention)'>
                    Blocked
                  </Text>
                  <Text
                    as='p'
                    className='mt-1 mb-0 font-mono text-xs whitespace-pre-wrap break-words text-(--fgColor-default)'
                  >
                    {step.blockedMessage}
                  </Text>
                </div>
              )}
              {step.content && (
                <div className='min-w-0'>
                  <Text as='p' className='m-0 mb-1 text-xs font-semibold text-(--fgColor-muted)'>
                    Content
                  </Text>
                  <pre className='min-w-0 overflow-x-auto rounded-md border border-(--borderColor-muted) bg-(--bgColor-muted) px-3 py-2 font-mono text-xs text-(--fgColor-default)'>
                    {typeof step.content === 'string'
                      ? step.content
                      : JSON.stringify(step.content, null, 2)}
                  </pre>
                </div>
              )}
              {step.logs && step.logs.length > 0 && (
                <div className='min-w-0'>
                  <Text as='p' className='m-0 mb-1 text-xs font-semibold text-(--fgColor-muted)'>
                    Logs ({step.logs.length})
                  </Text>
                  <div className='min-w-0 space-y-1'>
                    {step.logs.map((log: string, logIndex: number) => (
                      <div
                        key={logIndex}
                        className='min-w-0 rounded-sm border-l-2 border-(--borderColor-muted) bg-(--bgColor-muted) px-2 py-1 font-mono text-xs break-words text-(--fgColor-default)'
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Timeline.Body>
    </Timeline.Item>
  );
}

const StepsTimeline = ({ steps }: StepsTimelineProps) => {
  const [expandedId, setExpandedId] = React.useState<string | null>(
    () => steps.find((s) => s.error)?.id ?? null,
  );

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (steps.length === 0) {
    return (
      <Text as='p' className='m-0 text-sm text-(--fgColor-muted)'>
        No steps recorded for this push.
      </Text>
    );
  }

  return (
    <div className='mt-3 min-w-0'>
      <Timeline>
        {steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            expanded={expandedId === step.id}
            onToggle={() => toggle(step.id)}
          />
        ))}
      </Timeline>
    </div>
  );
};

export default StepsTimeline;
