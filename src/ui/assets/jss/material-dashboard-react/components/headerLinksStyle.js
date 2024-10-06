import {
  defaultFont,
  dangerColor,
  whiteColor,
  increaseSpecificity,
} from '../../material-dashboard-react.js';

// eslint-disable-next-line max-len
import dropdownStyle from '../dropdownStyle.js';

const headerLinksStyle = (theme) => ({
  ...dropdownStyle(theme),
  search: increaseSpecificity({
    '& > div': {
      marginTop: '0',
    },
    [theme.breakpoints.down('md')]: {
      margin: '10px 15px !important',
      float: 'none !important',
      paddingTop: '1px',
      paddingBottom: '1px',
      padding: '0!important',
      width: '60%',
      marginTop: '40px',
      '& input': {
        color: whiteColor,
      },
    },
  }),
  linkText: increaseSpecificity({
    zIndex: '4',
    ...defaultFont,
    fontSize: '14px',
    margin: '0px',
  }),
  buttonLink: increaseSpecificity({
    [theme.breakpoints.down('md')]: {
      display: 'flex',
      margin: '10px 15px 0',
      width: '-webkit-fill-available',
      '& svg': {
        width: '24px',
        height: '30px',
        marginRight: '15px',
        marginLeft: '-15px',
      },
      '& .fab,& .fas,& .far,& .fal,& .material-icons': {
        fontSize: '24px',
        lineHeight: '30px',
        width: '24px',
        height: '30px',
        marginRight: '15px',
        marginLeft: '-15px',
      },
      '& > span': {
        justifyContent: 'flex-start',
        width: '100%',
      },
    },
  }),
  searchButton: increaseSpecificity({
    [theme.breakpoints.down('md')]: {
      top: '-50px !important',
      marginRight: '22px',
      float: 'right',
    },
  }),
  margin: increaseSpecificity({
    zIndex: '4',
    margin: '0',
  }),
  searchIcon: increaseSpecificity({
    width: '17px',
    zIndex: '4',
  }),
  notifications: increaseSpecificity({
    zIndex: '4',
    [theme.breakpoints.up('md')]: {
      position: 'absolute',
      top: '2px',
      border: '1px solid ' + whiteColor,
      right: '4px',
      fontSize: '9px',
      background: dangerColor[0],
      color: whiteColor,
      minWidth: '16px',
      height: '16px',
      borderRadius: '10px',
      textAlign: 'center',
      lineHeight: '16px',
      verticalAlign: 'middle',
      display: 'block',
    },
    [theme.breakpoints.down('md')]: {
      ...defaultFont,
      fontSize: '14px',
      marginRight: '8px',
    },
  }),
  manager: increaseSpecificity({
    [theme.breakpoints.down('md')]: {
      width: '100%',
    },
    display: 'inline-block',
  }),
  searchWrapper: increaseSpecificity({
    [theme.breakpoints.down('md')]: {
      width: '-webkit-fill-available',
      margin: '10px 15px 0',
    },
    display: 'inline-block',
  }),
});

export default headerLinksStyle;
