import { Theme } from '@material-ui/core/styles/createTheme';
import { drawerWidth, transition, container } from '../../material-dashboard-react';

interface AppStyleProps {
  wrapper: React.CSSProperties;
  mainPanel: React.CSSProperties & {
    [key: string]: any;
  };
  content: React.CSSProperties;
  container: typeof container;
  map: React.CSSProperties;
}

const appStyle = (theme: Theme): AppStyleProps => ({
  wrapper: {
    position: 'relative',
    top: '0',
    height: '100vh',
  },
  mainPanel: {
    [theme.breakpoints.up('md')]: {
      width: `calc(100% - ${drawerWidth}px)`,
    },
    overflow: 'auto',
    position: 'relative',
    float: 'right',
    ...transition,
    maxHeight: '100%',
    width: '100%',
    WebkitOverflowScrolling: 'touch',
  },
  content: {
    marginTop: '70px',
    padding: '30px 15px',
    minHeight: 'calc(100vh - 123px)',
  },
  container: { ...container },
  map: {
    marginTop: '70px',
  },
});

export default appStyle;
