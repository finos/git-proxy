/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './homepage.module.css';

function Testimonials() {
  const { siteConfig } = useDocusaurusContext();
  const posts = siteConfig.customFields.posts.filter((post) => post.platform === 'linkedin');

  return (
    <section
      className={`${styles.section} ${styles.community}`}
      aria-labelledby='community-heading'
    >
      <h2 id='community-heading'>From the community</h2>
      <p>Explore posts about GitProxy shared by the community on LinkedIn.</p>
      <details className={styles.communityPosts}>
        <summary>Browse LinkedIn posts ({posts.length})</summary>
        <ul className={styles.communityLinks}>
          {posts.map(({ url }, index) => (
            <li key={url}>
              <a href={url.replace('/embed/feed/', '/feed/')}>LinkedIn post {index + 1}</a>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

export default Testimonials;
