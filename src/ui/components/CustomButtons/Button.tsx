import React from 'react';
import classNames from 'classnames';
import { makeStyles } from '@material-ui/core/styles';
import Button, { ButtonProps } from '@material-ui/core/Button';
import styles from '../../assets/jss/material-dashboard-react/components/buttonStyle';

const useStyles = makeStyles(styles);

type Color =
  | 'primary'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'rose'
  | 'white'
  | 'transparent';
type Size = 'sm' | 'lg';

interface RegularButtonProps extends Omit<ButtonProps, 'color' | 'size'> {
  color?: Color;
  round?: boolean;
  disabled?: boolean;
  simple?: boolean;
  size?: Size;
  block?: boolean;
  link?: boolean;
  justIcon?: boolean;
  className?: string;
  muiClasses?: Record<string, string>;
  children?: React.ReactNode;
}

export default function RegularButton(props: RegularButtonProps) {
  const classes = useStyles();
  const {
    color,
    round,
    children,
    disabled,
    simple,
    size,
    block,
    link,
    justIcon,
    className,
    muiClasses,
    ...rest
  } = props;

  const btnClasses = classNames({
    [classes.button]: true,
    [classes[size as Size]]: size,
    [classes[color as Color]]: color,
    [classes.round]: round,
    [classes.disabled]: disabled,
    [classes.simple]: simple,
    [classes.block]: block,
    [classes.link]: link,
    [classes.justIcon]: justIcon,
    [className || '']: className,
  });

  return (
    <Button {...rest} classes={muiClasses} className={btnClasses}>
      {children}
    </Button>
  );
}
