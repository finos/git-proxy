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

interface RegularButtonProps extends ButtonProps {
  customColor?: Color;
  round?: boolean;
  disabled?: boolean;
  simple?: boolean;
  customSize?: Size;
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
    customColor: color,
    round,
    children,
    disabled,
    simple,
    customSize: size,
    block,
    link,
    justIcon,
    className,
    muiClasses,
    ...rest
  } = props;

  const btnClasses = classNames({
    [classes.button]: true,
    [size ? classes[size] : '']: size,
    [color ? classes[color] : '']: color,
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
