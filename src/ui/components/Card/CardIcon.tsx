import React from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import styles from '../../assets/jss/material-dashboard-react/components/cardIconStyle';

const useStyles = makeStyles(styles);

type CardIconColor = 'warning' | 'success' | 'danger' | 'info' | 'primary' | 'rose';

interface CardIconProps {
  className?: string;
  color?: CardIconColor;
  children?: React.ReactNode;
  [key: string]: any;
}

const CardIcon: React.FC<CardIconProps> = (props) => {
  const classes = useStyles();
  const { className, children, color, ...rest } = props;

  const cardIconClasses = clsx({
    [classes.cardIcon]: true,
    [color ? classes[`${color}CardHeader`] : '']: color,
    [className || '']: className !== undefined,
  });

  return (
    <div className={cardIconClasses} {...rest}>
      {children}
    </div>
  );
};

export default CardIcon;
