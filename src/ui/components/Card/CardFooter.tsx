import React from 'react';
import classNames from 'classnames';
import { makeStyles } from '@material-ui/core/styles';
import styles from '../../assets/jss/material-dashboard-react/components/cardFooterStyle';

const useStyles = makeStyles(styles);

interface CardFooterProps extends React.ComponentProps<'div'> {
  className?: string;
  plain?: boolean;
  profile?: boolean;
  stats?: boolean;
  chart?: boolean;
  children?: React.ReactNode;
}

const CardFooter: React.FC<CardFooterProps> = ({
  className,
  children,
  plain,
  profile,
  stats,
  chart,
  ...rest
}) => {
  const classes = useStyles();

  const cardFooterClasses = classNames({
    [classes.cardFooter]: true,
    [classes.cardFooterPlain]: plain,
    [classes.cardFooterProfile]: profile,
    [classes.cardFooterStats]: stats,
    [classes.cardFooterChart]: chart,
    [className || '']: className !== undefined,
  });

  return (
    <div className={cardFooterClasses} {...rest}>
      {children}
    </div>
  );
};

export default CardFooter;
