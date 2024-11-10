import {
  defaultFont,
  primaryBoxShadow,
  infoBoxShadow,
  successBoxShadow,
  warningBoxShadow,
  dangerBoxShadow,
  roseBoxShadow,
  whiteColor,
  blackColor,
  grayColor,
  infoColor,
  successColor,
  dangerColor,
  roseColor,
  primaryColor,
  warningColor,
  hexToRgb,
  increaseSpecificity,
} from '../../material-dashboard-react.js';

const snackbarContentStyle = {
  root: increaseSpecificity({
    ...defaultFont,
    flexWrap: 'unset',
    position: 'relative',
    padding: '20px 15px',
    lineHeight: '20px',
    marginBottom: '20px',
    fontSize: '14px',
    backgroundColor: whiteColor,
    color: grayColor[7],
    borderRadius: '3px',
    minWidth: 'unset',
    maxWidth: 'unset',
    boxShadow:
      '0 12px 20px -10px rgba(' +
      hexToRgb(whiteColor) +
      ', 0.28), 0 4px 20px 0px rgba(' +
      hexToRgb(blackColor) +
      ', 0.12), 0 7px 8px -5px rgba(' +
      hexToRgb(whiteColor) +
      ', 0.2)',
  }),
  top20: increaseSpecificity({
    top: '20px',
  }),
  top40: increaseSpecificity({
    top: '40px',
  }),
  info: increaseSpecificity({
    backgroundColor: infoColor[3],
    color: whiteColor,
    ...infoBoxShadow,
  }),
  success: increaseSpecificity({
    backgroundColor: successColor[3],
    color: whiteColor,
    ...successBoxShadow,
  }),
  warning: increaseSpecificity({
    backgroundColor: warningColor[3],
    color: whiteColor,
    ...warningBoxShadow,
  }),
  danger: increaseSpecificity({
    backgroundColor: dangerColor[3],
    color: whiteColor,
    ...dangerBoxShadow,
  }),
  primary: increaseSpecificity({
    backgroundColor: primaryColor[3],
    color: whiteColor,
    ...primaryBoxShadow,
  }),
  rose: increaseSpecificity({
    backgroundColor: roseColor[3],
    color: whiteColor,
    ...roseBoxShadow,
  }),
  message: increaseSpecificity({
    padding: '0',
    display: 'block',
    maxWidth: '89%',
  }),
  close: increaseSpecificity({
    width: '11px',
    height: '11px',
  }),
  iconButton: increaseSpecificity({
    width: '24px',
    height: '24px',
    padding: '0px',
  }),
  icon: increaseSpecificity({
    display: 'block',
    left: '15px',
    position: 'absolute',
    top: '50%',
    marginTop: '-15px',
    width: '30px',
    height: '30px',
  }),
  infoIcon: increaseSpecificity({
    color: infoColor[3],
  }),
  successIcon: increaseSpecificity({
    color: successColor[3],
  }),
  warningIcon: increaseSpecificity({
    color: warningColor[3],
  }),
  dangerIcon: increaseSpecificity({
    color: dangerColor[3],
  }),
  primaryIcon: increaseSpecificity({
    color: primaryColor[3],
  }),
  roseIcon: increaseSpecificity({
    color: roseColor[3],
  }),
  iconMessage: increaseSpecificity({
    paddingLeft: '50px',
    display: 'block',
  }),
  actionRTL: increaseSpecificity({
    marginLeft: '-8px',
    marginRight: 'auto',
  }),
};

export default snackbarContentStyle;
