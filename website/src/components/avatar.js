import React from 'react';
import PropTypes from 'prop-types';

/**
 * Avatar component
 * @param {*} props
 * @return {JSX.Element}
 */
export default function Avatar({ name, description, username }) {
  // add prop validation
  Avatar.propTypes = {
    name: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
  };

  const profileUrl = `https://github.com/${username}`;
  const imageUrl = `${profileUrl}.png`;

  return (
    <div className="avatar avatar--vertical margin-bottom--xl">
      <img
        className="avatar__photo avatar__photo--xl margin-bottom--md"
        src={imageUrl}
      />
      <div className="avatar__intro">
        <div className="avatar__name">{name}</div>
        <small className="avatar__subtitle">{description}</small>
        <small className="avatar__subtitle text--bold">
          <a href={profileUrl} target="__blank">
            @{username}
          </a>
        </small>
      </div>
    </div>
  );
}
