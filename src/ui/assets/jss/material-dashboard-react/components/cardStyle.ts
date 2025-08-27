import { createStyles } from '@material-ui/core/styles';
import { blackColor, whiteColor, hexToRgb } from '../../material-dashboard-react';

const cardStyle = createStyles({
  card: {
    border: '0',
    marginBottom: '30px',
    marginTop: '30px',
    borderRadius: '6px',
    color: `rgba(${hexToRgb(blackColor)}, 0.87)`,
    background: whiteColor,
    width: '100%',
    boxShadow: `0 1px 4px 0 rgba(${hexToRgb(blackColor)}, 0.14)`,
    position: 'relative' as const,
    display: 'flex' as const,
    flexDirection: 'column' as const,
    minWidth: '0',
    wordWrap: 'break-word' as const,
    fontSize: '.875rem',
  },
  cardPlain: {
    background: 'transparent',
    boxShadow: 'none',
  },
  cardProfile: {
    marginTop: '30px',
    textAlign: 'center' as const,
  },
  cardChart: {
    '& p': {
      marginTop: '0px',
      paddingTop: '0px',
    },
  },
});

export default cardStyle;
