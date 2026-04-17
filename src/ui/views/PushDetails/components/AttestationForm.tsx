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
import { Checkbox, Stack, Text } from '@primer/react';
import { QuestionFormData } from '../../../types';

interface AttestationFormProps {
  formData: QuestionFormData[];
  passFormData: (data: QuestionFormData[]) => void;
}

const AttestationForm = ({ formData, passFormData }: AttestationFormProps) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const name = parseInt(event.target.name, 10);
    const checked = event.target.checked;
    const clone = [...formData];
    clone[name] = { ...clone[name], checked };
    passFormData(clone);
  };

  return (
    <Stack direction='vertical' gap='normal' padding='none'>
      {formData.map((question, index) => {
        const inputId = `attestation-check-${index}`;
        const hasLinks = Boolean(question.tooltip.links?.length);

        return (
          <div key={index} className='flex min-w-0 items-start gap-3'>
            <Checkbox
              id={inputId}
              checked={question.checked}
              onChange={handleChange}
              name={index.toString()}
              className='!m-0 shrink-0 self-start'
            />
            <div className='min-w-0 flex-1'>
              <label
                htmlFor={inputId}
                className='!m-0 block cursor-pointer select-none !text-base !font-normal !leading-4 !text-[var(--fgColor-default)]'
              >
                {question.label}
              </label>
              {hasLinks ? (
                <ul className='m-0 mt-1.5 list-none space-y-1 pl-0'>
                  {question.tooltip.links!.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <Text as='span' className='!text-base !text-[var(--fgColor-default)]'>
                        <a
                          href={link.url}
                          target='_blank'
                          rel='noreferrer'
                          className='text-[var(--fgColor-accent)] underline hover:no-underline'
                        >
                          {link.text}
                        </a>
                      </Text>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        );
      })}
    </Stack>
  );
};

export default AttestationForm;
