import React from 'react';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import makeStyles from '@mui/styles/makeStyles';
import styles from '../../assets/jss/material-dashboard-react/components/cardIconStyle';

const useStyles = makeStyles(styles);

export default function CardIcon(props) {
  const classes = useStyles();
  const { className, children, color, ...rest } = props;
  const cardIconClasses = classNames({
    [classes.cardIcon]: true,
    [classes[color + 'CardHeader']]: color,
    [className]: className !== undefined,
  });
  return (
    <div className={cardIconClasses} {...rest}>
      {children}
    </div>
  );
}

CardIcon.propTypes = {
  className: PropTypes.string,
  color: PropTypes.oneOf(['warning', 'success', 'danger', 'info', 'primary', 'rose']),
  children: PropTypes.node,
};
