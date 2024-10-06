import {
  primaryColor,
  blackColor,
  hexToRgb,
  increaseSpecificity,
} from '../material-dashboard-react.js';

const checkboxAdnRadioStyle = {
  root: increaseSpecificity({
    padding: '13px',
    '&:hover': {
      backgroundColor: 'unset',
    },
  }),
  labelRoot: increaseSpecificity({
    marginLeft: '-14px',
  }),
  checked: increaseSpecificity({
    color: primaryColor[0] + '!important',
  }),
  checkedIcon: increaseSpecificity({
    width: '20px',
    height: '20px',
    border: '1px solid rgba(' + hexToRgb(blackColor) + ', .54)',
    borderRadius: '3px',
  }),
  uncheckedIcon: increaseSpecificity({
    width: '0px',
    height: '0px',
    padding: '10px',
    border: '1px solid rgba(' + hexToRgb(blackColor) + ', .54)',
    borderRadius: '3px',
  }),
  radio: increaseSpecificity({
    color: primaryColor[0] + '!important',
  }),
  radioChecked: increaseSpecificity({
    width: '20px',
    height: '20px',
    border: '1px solid ' + primaryColor[0],
    borderRadius: '50%',
  }),
  radioUnchecked: increaseSpecificity({
    width: '0px',
    height: '0px',
    padding: '10px',
    border: '1px solid rgba(' + hexToRgb(blackColor) + ', .54)',
    borderRadius: '50%',
  }),
};

export default checkboxAdnRadioStyle;
