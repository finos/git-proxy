/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.    
 */
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
