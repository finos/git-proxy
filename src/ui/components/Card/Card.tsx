import React from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import styles from '../../assets/jss/material-dashboard-react/components/cardStyle';

const useStyles = makeStyles(styles);

interface CardProps extends React.ComponentProps<'div'> {
  className?: string;
  plain?: boolean;
  profile?: boolean;
  chart?: boolean;
  children?: React.ReactNode;
}

const Card: React.FC<CardProps> = ({
  className = '',
  children,
  plain = false,
  profile = false,
  chart = false,
  ...rest
}) => {
  const classes = useStyles();

  const cardClasses = clsx({
    [classes.card]: true,
    [classes.cardPlain]: plain,
    [classes.cardProfile]: profile,
    [classes.cardChart]: chart,
    [className]: className,
  });

  return (
    <div className={cardClasses} {...rest}>
      {children}
    </div>
  );
};

export default Card;
