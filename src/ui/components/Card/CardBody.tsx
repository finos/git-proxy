import React from 'react';
import classNames from 'classnames';
import { makeStyles } from '@material-ui/core/styles';
import styles from '../../assets/jss/material-dashboard-react/components/cardBodyStyle';

const useStyles = makeStyles(styles);

interface CardBodyProps extends React.ComponentProps<'div'> {
  className?: string;
  plain?: boolean;
  profile?: boolean;
  children?: React.ReactNode;
}

const CardBody: React.FC<CardBodyProps> = ({
  className = '',
  children,
  plain = false,
  profile = false,
  ...rest
}) => {
  const classes = useStyles();
  
  const cardBodyClasses = classNames({
    [classes.cardBody]: true,
    [classes.cardBodyPlain]: plain,
    [classes.cardBodyProfile]: profile,
    [className]: className,
  });

  return (
    <div className={cardBodyClasses} {...rest}>
      {children}
    </div>
  );
};

export default CardBody;