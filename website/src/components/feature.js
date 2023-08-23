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
