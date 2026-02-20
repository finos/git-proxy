import React, { Component, ErrorInfo, PropsWithChildren, ReactNode, useState } from 'react';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import Collapse from '@material-ui/core/Collapse';
import { makeStyles } from '@material-ui/core/styles';

const IS_DEV = process.env.NODE_ENV !== 'production';

const useStyles = makeStyles((theme) => ({
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '60vh',
    padding: theme.spacing(2),
  },
  root: {
    padding: theme.spacing(4),
    borderLeft: `4px solid ${theme.palette.error.main}`,
    maxWidth: 560,
    width: '100%',
  },
  title: {
    color: theme.palette.error.main,
    marginBottom: theme.spacing(1),
  },
  message: {
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
  },
  hint: {
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'center',
    marginBottom: theme.spacing(1),
  },
  stack: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(2),
    backgroundColor: theme.palette.grey[100],
    borderRadius: theme.shape.borderRadius,
    overflowX: 'auto',
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  devBadge: {
    display: 'inline-block',
    marginBottom: theme.spacing(2),
    padding: '2px 8px',
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
    borderRadius: theme.shape.borderRadius,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
}));

const ProdFallback = ({ reset }: { reset: () => void }) => {
  const classes = useStyles();
  return (
    <div className={classes.wrapper}>
      <Paper className={classes.root} role='alert' elevation={0} variant='outlined'>
        <Typography variant='h6' className={classes.title}>
          Something went wrong
        </Typography>
        <Typography variant='body2' className={classes.message}>
          An unexpected error occurred. Please try again — if the problem persists, contact your
          administrator.
        </Typography>
        <div className={classes.actions}>
          <Button variant='outlined' size='small' color='primary' onClick={reset}>
            Retry
          </Button>
          <Button size='small' onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </Paper>
    </div>
  );
};

const DevFallback = ({
  error,
  name,
  reset,
}: {
  error: Error;
  name?: string;
  reset: () => void;
}) => {
  const classes = useStyles();
  const [showDetails, setShowDetails] = useState(false);
  const context = name ? ` in ${name}` : '';

  return (
    <div className={classes.wrapper}>
      <Paper className={classes.root} role='alert' elevation={0} variant='outlined'>
        <div className={classes.devBadge}>dev</div>
        <Typography variant='h6' className={classes.title}>
          Something went wrong{context}
        </Typography>
        <Typography variant='body2' className={classes.message}>
          {error.message}
        </Typography>
        <div className={classes.actions}>
          <Button variant='outlined' size='small' color='primary' onClick={reset}>
            Retry
          </Button>
          {error.stack && (
            <Button size='small' onClick={() => setShowDetails((v) => !v)}>
              {showDetails ? 'Hide stack trace' : 'Show stack trace'}
            </Button>
          )}
        </div>
        {error.stack && (
          <Collapse in={showDetails}>
            <pre className={classes.stack}>{error.stack}</pre>
          </Collapse>
        )}
      </Paper>
    </div>
  );
};

type Props = PropsWithChildren<{
  name?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}>;

type State = { error: Error | undefined };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: undefined };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  reset = () => this.setState({ error: undefined });

  render() {
    const { error } = this.state;
    const { children, fallback, name } = this.props;

    if (error) {
      if (fallback) return fallback(error, this.reset);
      return IS_DEV ? (
        <DevFallback error={error} name={name} reset={this.reset} />
      ) : (
        <ProdFallback reset={this.reset} />
      );
    }

    return children;
  }
}
