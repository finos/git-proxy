import { hexToRgb, increaseSpecificity, whiteColor } from '../../material-dashboard-react.js';

const customTabsStyle = {
  cardTitle: increaseSpecificity({
    float: 'left',
    padding: '10px 10px 10px 0px',
    lineHeight: '24px',
  }),
  cardTitleRTL: increaseSpecificity({
    float: 'right',
    padding: '10px 0px 10px 10px !important',
  }),
  displayNone: increaseSpecificity({
    display: 'none !important',
  }),
  tabsRoot: increaseSpecificity({
    minHeight: 'unset !important',
    overflowX: 'visible',
    '& $tabRootButton': {
      fontSize: '0.875rem',
    },
  }),
  tabRootButton: increaseSpecificity({
    minHeight: 'unset !important',
    minWidth: 'unset !important',
    width: 'unset !important',
    height: 'unset !important',
    maxWidth: 'unset !important',
    maxHeight: 'unset !important',
    padding: '10px 15px',
    borderRadius: '3px',
    lineHeight: '24px',
    border: '0 !important',
    color: whiteColor + ' !important',
    marginLeft: '4px',
    '&:last-child': {
      marginLeft: '0px',
    },
  }),
  tabSelected: increaseSpecificity({
    backgroundColor: 'rgba(' + hexToRgb(whiteColor) + ', 0.2)',
    transition: '0.2s background-color 0.1s',
  }),
  tabWrapper: increaseSpecificity({
    display: 'inline-block',
    minHeight: 'unset !important',
    minWidth: 'unset !important',
    width: 'unset !important',
    height: 'unset !important',
    maxWidth: 'unset !important',
    maxHeight: 'unset !important',
    fontWeight: '500',
    fontSize: '12px',
    marginTop: '1px',
    '& > svg,& > .material-icons': {
      verticalAlign: 'middle',
      margin: '-1px 5px 0 0 !important',
    },
  }),
};

export default customTabsStyle;
