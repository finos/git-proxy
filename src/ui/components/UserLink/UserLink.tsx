import React from 'react';
import { Link } from 'react-router-dom';

interface UserLinkProps {
  username: string;
  children?: React.ReactNode;
}

const UserLink: React.FC<UserLinkProps> = ({ username, children }) => {
  return <Link to={`/dashboard/user/${username}`}>{children || username}</Link>;
};

export default UserLink;
