import * as Diff2Html from 'diff2html';
import ReactHtmlParser from 'react-html-parser'; 

export default function Diff(props) {
  const {diff} = props;  
  let outputHtml = Diff2Html.html(diff, { drawFileList: true, matching: 'lines' });  

  return (
    ReactHtmlParser (outputHtml)
  );
}