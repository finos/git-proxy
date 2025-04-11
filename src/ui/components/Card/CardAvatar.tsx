import React from 'react';
import classNames from 'classnames';
import { makeStyles } from '@material-ui/core/styles';
import styles from '../../assets/jss/material-dashboard-react/components/cardAvatarStyle';

const useStyles = makeStyles(styles);

interface CardAvatarProps extends React.ComponentProps<'div'> {
  children: React.ReactNode;
  className?: string;
  profile?: boolean;
  plain?: boolean;
}

const CardAvatar: React.FC<CardAvatarProps> = ({
  children,
  className = '',
  profile = false,
  plain = false,
  ...rest
}) => {
  const classes = useStyles();

  const cardAvatarClasses = classNames({
    [classes.cardAvatar]: true,
    [classes.cardAvatarProfile]: profile,
    [classes.cardAvatarPlain]: plain,
    [className]: className,
  });

  return (
    <div className={cardAvatarClasses} {...rest}>
      {children}
    </div>
  );
};

export default CardAvatar;
