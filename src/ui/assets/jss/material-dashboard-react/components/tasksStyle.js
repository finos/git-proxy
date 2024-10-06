import {
  defaultFont,
  primaryColor,
  dangerColor,
  grayColor,
  increaseSpecificity,
} from '../../material-dashboard-react.js';
import tooltipStyle from '..t/tooltipStyle.js';
import checkboxAdnRadioStyle from '../checkboxAdnRadioStyle.js';
const tasksStyle = {
  ...tooltipStyle,
  ...checkboxAdnRadioStyle,
  table: increaseSpecificity({
    marginBottom: '0',
    overflow: 'visible',
  }),
  tableRow: increaseSpecificity({
    position: 'relative',
    borderBottom: '1px solid ' + grayColor[5],
  }),
  tableActions: increaseSpecificity({
    display: 'flex',
    border: 'none',
    padding: '12px 8px !important',
    verticalAlign: 'middle',
  }),
  tableCell: increaseSpecificity({
    ...defaultFont,
    padding: '8px',
    verticalAlign: 'middle',
    border: 'none',
    lineHeight: '1.42857143',
    fontSize: '14px',
  }),
  tableCellRTL: increaseSpecificity({
    textAlign: 'right',
  }),
  tableActionButton: increaseSpecificity({
    width: '27px',
    height: '27px',
    padding: '0',
  }),
  tableActionButtonIcon: increaseSpecificity({
    width: '17px',
    height: '17px',
  }),
  edit: increaseSpecificity({
    backgroundColor: 'transparent',
    color: primaryColor[0],
    boxShadow: 'none',
  }),
  close: increaseSpecificity({
    backgroundColor: 'transparent',
    color: dangerColor[0],
    boxShadow: 'none',
  }),
};
export default tasksStyle;
