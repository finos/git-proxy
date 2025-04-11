import React from 'react';
import classNames from 'classnames';
import { makeStyles } from '@material-ui/core/styles';
import styles from '../../assets/jss/material-dashboard-react/components/cardHeaderStyle';

const useStyles = makeStyles(styles);

type CardHeaderColor = 'warning' | 'success' | 'danger' | 'info' | 'primary' | 'rose';

interface CardHeaderProps extends React.ComponentProps<'div'> {
  className?: string;
  color?: CardHeaderColor;
  plain?: boolean;
  stats?: boolean;
  icon?: boolean;
  children?: React.ReactNode;
}

const CardHeader: React.FC<CardHeaderProps> = (props) => {
  const classes = useStyles();
  const { className, children, color, plain, stats, icon, ...rest } = props;

  const cardHeaderClasses = classNames({
    [classes.cardHeader]: true,
    [color ? classes[`${color}CardHeader`] : '']: color,
    [classes.cardHeaderPlain]: plain,
    [classes.cardHeaderStats]: stats,
    [classes.cardHeaderIcon]: icon,
    [className || '']: className !== undefined,
  });

  return (
    <div className={cardHeaderClasses} {...rest}>
      {children}
    </div>
  );
};

export default CardHeader;
