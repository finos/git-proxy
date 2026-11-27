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

import React, { useEffect } from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Avatar from '../components/avatar';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './homepage.module.css';
import Testimonials from './testimonials';
import TerminalDemo from '../components/terminalDemo';
import axios from 'axios';

const capabilities = [
  {
    number: '01',
    title: 'Inspect',
    description:
      'Analyse pushes before they leave your organisation, including commits, authors, diffs and secrets. Built-in processors include hidden-commit detection and Gitleaks secret scanning.',
    to: '/docs/architecture/processors',
    link: 'Explore the checks',
  },
  {
    number: '02',
    title: 'Enforce',
    description:
      'Apply repository access rules, commit policies, pre-receive hooks and approval workflows at the point of push.',
    to: '/docs/configuration/reference',
    link: 'Configure your policies',
  },
  {
    number: '03',
    title: 'Extend',
    description:
      'Add organisation-specific controls using configurable plugins, distributed as standard npm packages or loaded as JavaScript modules.',
    to: '/docs/development/plugins',
    link: 'Build a plugin',
  },
  {
    number: '04',
    title: 'Work across Git platforms',
    description:
      'Proxy GitHub, GitLab and other Git hosts from one instance. GitProxy v2 supports multiple hosts and Git operations over HTTP/HTTPS or SSH.',
    to: '/docs/upgrading-to-v2',
    link: 'Discover multi-host support',
  },
];

/**
 * Home page component
 * @return {JSX.Element}
 */
function Home() {
  const context = useDocusaurusContext();
  const { siteConfig = {} } = context;
  const logoUrl = useBaseUrl('/img/git-proxy.png');

  const [demoOpen, setDemoOpen] = React.useState(false);
  const [contributors, setContributors] = React.useState([]);

  useEffect(() => {
    axios
      .get('https://api.github.com/repos/finos/git-proxy/contributors')
      .then(({ data }) => {
        if (Array.isArray(data)) setContributors(data);
      })
      .catch(() => {
        // The GitHub contributors link remains available if the API cannot load.
      });
  }, []);

  return (
    <Layout title={`${siteConfig.title}`} description={`${siteConfig.tagline}`}>
      <main className={styles.home}>
        <section className={styles.hero} aria-labelledby='intro-heading'>
          <div className={styles.heroInner}>
            <img className={styles.logo} src={logoUrl} alt='GitProxy' width='889' height='393' />
            <h1 id='intro-heading'>
              Open source contribution.
              <br />
              <span>With your guardrails.</span>
            </h1>
            <p className={styles.heroDescription}>
              An open source policy and control layer between developers and Git hosting platforms.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} to='/docs/category/quickstart'>
                Get started <span aria-hidden='true'>↗</span>
              </Link>
              <Link className={styles.secondaryAction} to='/docs'>
                Read the documentation <span aria-hidden='true'>→</span>
              </Link>
            </div>
            <p className={styles.projectNote}>Open source · Apache 2.0 · A FINOS project</p>
          </div>
        </section>

        <section className={styles.section} aria-labelledby='capabilities-heading'>
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>Built around your workflow</p>
            <h2 id='capabilities-heading'>Keep Git. Add the controls you need.</h2>
            <p>
              GitProxy intercepts Git pushes and applies configurable checks and workflows before
              changes reach the remote repository. Combine the familiar open source contribution
              experience with your organisation’s security, legal and compliance requirements.
            </p>
          </div>
          <div className={styles.capabilities}>
            {capabilities.map(({ number, title, description, to, link }) => (
              <article className={styles.capability} key={title}>
                <span className={styles.number} aria-hidden='true'>
                  {number}
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <Link className={styles.textLink} to={to}>
                    {link} <span aria-hidden='true'>→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.workflow} aria-labelledby='workflow-heading'>
          <div className={styles.section}>
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>Familiar Git. Configurable controls.</p>
              <h2 id='workflow-heading'>Security controls without changing how developers work.</h2>
              <p>
                Developers continue to branch, commit and push with Git. GitProxy sits in the path
                to the remote Git service, evaluates the push, and either blocks it with feedback or
                allows it through the configured workflow.
              </p>
            </div>
            <ol className={styles.flow} aria-label='How a push moves through GitProxy'>
              <li className={styles.flowStep}>
                <span className={styles.flowLabel}>01 / Developer</span>
                <h3>Branch. Commit. Push.</h3>
                <p>Use the Git tools and workflow you already know.</p>
              </li>
              <li className={`${styles.flowStep} ${styles.flowProxy}`}>
                <span className={styles.flowLabel}>02 / GitProxy</span>
                <h3>Your policies, at push.</h3>
                <p>Inspect changes, enforce rules and follow configured approvals.</p>
              </li>
              <li className={styles.flowStep}>
                <span className={styles.flowLabel}>03 / Git hosting</span>
                <h3>Your remote repository.</h3>
                <p>Changes proceed when the configured checks and workflow allow them.</p>
              </li>
            </ol>
            <details className={styles.workflowDetails}>
              <summary>What happens when a push needs approval?</summary>
              <p>
                GitProxy blocks the push and provides a link to request approval. Once the push is
                approved, the developer can retry it using the same Git command.
              </p>
            </details>
            <details
              className={styles.workflowDetails}
              onToggle={(event) => setDemoOpen(event.currentTarget.open)}
            >
              <summary>See a protected push in action</summary>
              {demoOpen && (
                <>
                  <TerminalDemo
                    src='/demo/git-push.cast'
                    narrowSrc='/demo/git-push-narrow.cast'
                    posterAt='0:14'
                    label='Terminal recording showing a blocked push, remediation and an approval request.'
                  />
                  <p>
                    <Link to='https://www.finos.org/hubfs/Projects%20%2B%20SIGs/Open%20Source%20Readiness%20OSR/OSR%20Meeting_%20GitProxy%20Jamie%20Slome%20Citi%20Presentation.mp4#t=496'>
                      Watch the full GitProxy demo
                    </Link>
                  </p>
                </>
              )}
            </details>
            <Link className={styles.textLink} to='/docs/architecture/processors'>
              Explore the processing chain <span aria-hidden='true'>→</span>
            </Link>
          </div>
        </section>

        <section className={`${styles.section} ${styles.join}`} aria-labelledby='join-heading'>
          <div>
            <p className={styles.eyebrow}>A FINOS project, built in the open</p>
            <h2 id='join-heading'>Try it. Use it. Help shape it.</h2>
            <p>
              Start with GitProxy, explore the code, or contribute a control your organisation
              needs.
            </p>
          </div>
          <div className={styles.joinLinks}>
            <Link className={styles.textLink} to='/docs/category/quickstart'>
              Quickstart <span aria-hidden='true'>↗</span>
            </Link>
            <Link className={styles.textLink} to='https://github.com/finos/git-proxy'>
              View on GitHub <span aria-hidden='true'>↗</span>
            </Link>
            <Link
              className={styles.textLink}
              to='https://github.com/finos/git-proxy/blob/main/CONTRIBUTING.md'
            >
              Contribute <span aria-hidden='true'>↗</span>
            </Link>
          </div>
        </section>
        <Testimonials />
        <section
          className={`${styles.section} ${styles.maintainers}`}
          aria-labelledby='maintainers-heading'
        >
          <h2 id='maintainers-heading'>Our maintainers</h2>
          <ul className={styles.maintainerList}>
            <li>
              <Avatar name='Paul Groves' description='Director at Citi' username='grovesy' />
            </li>
            <li>
              <Avatar name='Jamie Slome' description='Emeritus Maintainer' username='JamieSlome' />
            </li>
            <li>
              <Avatar
                name='Juan Escalada'
                description='Open Source Software Engineer at G-Research'
                username='jescalada'
              />
            </li>
            <li>
              <Avatar
                name='Kris West'
                description='Principal Engineer at NatWest Group'
                username='kriswest'
              />
            </li>
            <li>
              <Avatar
                name='Thomas Cooper'
                description='Director, OSS Development at RBC'
                username='coopernetes'
              />
            </li>
            <li>
              <Avatar
                name='Jack Kelly'
                description='Senior Consultant at ControlPlane'
                username='06kellyjac'
              />
            </li>
            <li>
              <Avatar
                name='Andy Pols'
                description='Engineer at Qube Research & Technologies'
                username='andypols'
              />
            </li>
            <li>
              <Avatar
                name='Fabio Vincenzi'
                description='Open Source Software Engineer at G-Research'
                username='fabiovincenzi'
              />
            </li>
            <li>
              <Avatar
                name='Denis Coric'
                description='Open Source Software Engineer at G-Research'
                username='dcoric'
              />
            </li>
          </ul>
        </section>
        <section
          className={`${styles.section} ${styles.maintainers}`}
          aria-labelledby='contributors-heading'
        >
          <h2 id='contributors-heading'>Our contributors</h2>
          <ul className={styles.maintainerList}>
            {contributors
              .filter(({ id }) => ![29139614, 49699333].includes(id))
              .map(({ id, login, contributions }) => (
                <li key={id}>
                  <Avatar
                    name={login}
                    description={`${contributions} ${contributions === 1 ? 'contribution' : 'contributions'}`}
                    username={login}
                  />
                </li>
              ))}
          </ul>
          <a href='https://github.com/finos/git-proxy/graphs/contributors'>
            View contributors on GitHub
          </a>
        </section>
      </main>
    </Layout>
  );
}

export default Home;
