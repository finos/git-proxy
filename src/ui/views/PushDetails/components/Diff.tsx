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
import * as Diff2Html from 'diff2html';
import parse from 'html-react-parser';

interface DiffProps {
  diff: string;
}

const Diff = ({ diff }: DiffProps) => {
  const outputHtml = Diff2Html.html(diff, {
    drawFileList: true,
    matching: 'lines',
    outputFormat: 'side-by-side',
  });

  return <>{parse(outputHtml)}</>;
};

export default Diff;
