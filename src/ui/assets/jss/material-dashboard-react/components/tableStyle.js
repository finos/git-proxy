import {
  warningColor,
  primaryColor,
  dangerColor,
  successColor,
  infoColor,
  roseColor,
  grayColor,
  defaultFont,
  increaseSpecificity,
} from '../../material-dashboard-react.js';

const tableStyle = (theme) => ({
  warningTableHeader: increaseSpecificity({
    color: warningColor[0],
  }),
  primaryTableHeader: increaseSpecificity({
    color: primaryColor[0],
  }),
  dangerTableHeader: increaseSpecificity({
    color: dangerColor[0],
  }),
  successTableHeader: increaseSpecificity({
    color: successColor[0],
  }),
  infoTableHeader: increaseSpecificity({
    color: infoColor[0],
  }),
  roseTableHeader: increaseSpecificity({
    color: roseColor[0],
  }),
  grayTableHeader: increaseSpecificity({
    color: grayColor[0],
  }),
  table: increaseSpecificity({
    marginBottom: '0',
    width: '100%',
    maxWidth: '100%',
    backgroundColor: 'transparent',
    borderSpacing: '0',
    borderCollapse: 'collapse',
  }),
  tableHeadCell: increaseSpecificity({
    color: 'inherit',
    ...defaultFont,
    '&, &$tableCell': {
      fontSize: '1em',
    },
  }),
  tableCell: increaseSpecificity({
    ...defaultFont,
    lineHeight: '1.42857143',
    padding: '12px 8px',
    verticalAlign: 'middle',
    fontSize: '0.8125rem',
  }),
  tableResponsive: increaseSpecificity({
    width: '100%',
    marginTop: theme.spacing(3),
    overflowX: 'auto',
  }),
  tableHeadRow: increaseSpecificity({
    height: '56px',
    color: 'inherit',
    display: 'table-row',
    outline: 'none',
    verticalAlign: 'middle',
  }),
  tableBodyRow: increaseSpecificity({
    height: '48px',
    color: 'inherit',
    display: 'table-row',
    outline: 'none',
    verticalAlign: 'middle',
  }),
});

export default tableStyle;
