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
import classnames from 'classnames';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from '../pages/styles.module.css';
import PropTypes from 'prop-types';

/**
 * Feature page component
 * @param {*} props
 * @return {JSX.Element}
 */
export default function Feature({
  imageUrl,
  title,
  description,
  about,
  project,
  involved,
}) {
  // add prop validation
  Feature.propTypes = {
    imageUrl: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    about: PropTypes.shape({
      title: PropTypes.string.isRequired,
      link: PropTypes.string.isRequired,
    }),
    project: PropTypes.shape({
      title: PropTypes.string.isRequired,
      link: PropTypes.string.isRequired,
    }),
    involved: PropTypes.shape({
      title: PropTypes.string.isRequired,
      link: PropTypes.string.isRequired,
    }),
  };
  const imgUrl = useBaseUrl(imageUrl);

  const defined = function (property) {
    return typeof property !== 'undefined';
  };

  return (
    <div
      className={classnames('text--center col col--4 padding', styles.feature)}
    >
      {imgUrl && (
        <div>
          <img className={styles.featureImage} src={imgUrl} alt={title} />
        </div>
      )}
      <h3>{title}</h3>
      <p>{description}</p>
      <div className={classnames(styles.featureCTA)}>
        {defined(about) &&
          defined(about.title) &&
          defined(about.link) &&
          about.link !== '' && (
            <ul>
              <li>
                <a href={about.link}>{about.title}</a>
              </li>
            </ul>
          )}
        {defined(project) &&
          defined(project.title) &&
          defined(project.link) &&
          project.link !== '' && (
            <ul>
              <li>
                <a href={project.link}>{project.title}</a>
              </li>
            </ul>
          )}
        {defined(involved) &&
          defined(involved.title) &&
          defined(involved.link) &&
          involved.link !== '' && (
            <ul>
              <li>
                <a href={involved.link}>{involved.title}</a>
              </li>
            </ul>
          )}
      </div>
    </div>
  );
}
