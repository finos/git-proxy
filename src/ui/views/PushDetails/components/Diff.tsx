import * as Diff2Html from 'diff2html';
import reactHtmlParser from 'react-html-parser'; // Renamed to follow function naming conventions
import React from 'react';

interface DiffProps {
  diff: string;
}

const Diff: React.FC<DiffProps> = ({ diff }) => {
  const outputHtml = Diff2Html.html(diff, {
    drawFileList: true,
    matching: 'lines',
    outputFormat: 'side-by-side',
  });

  return <>{reactHtmlParser(outputHtml)}</>;
};

export default Diff;
