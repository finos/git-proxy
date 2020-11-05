/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import * as Diff2Html from 'diff2html';
import ReactHtmlParser from 'react-html-parser';

export default function Diff(props) {
  const {diff} = props;
  const outputHtml = Diff2Html.html(diff, {drawFileList: true, matching: 'lines'});

  return (
    new ReactHtmlParser(outputHtml)
  );
}
