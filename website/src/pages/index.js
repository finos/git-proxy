import React from 'react';
import classnames from 'classnames';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './styles.module.css';
import Feature from '../components/feature';
import { features } from '../components/feature-config';

function Home() {
  const context = useDocusaurusContext();
  const {siteConfig = {}} = context;
  return (
    <Layout
      title={`${siteConfig.title}`}
      description={`${siteConfig.tagline}`}>
      <header className={classnames('hero hero--primary', styles.heroBanner)}>
        <div className="container">
          <h1 className="hero__title">{siteConfig.title}</h1>
          <p className={classnames('hero--subtitle')}>{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            {/* TODO - point to a getting started page, when available */}
            {/* <Link
              className={classnames(
                'button button--outline button--secondary button--lg',
                styles.getStarted
              )}
              to={'https://finos.org/'}>
              GET STARTED
            </Link> */}
            <Link
              className={classnames(
                'button button--outline button--secondary button--lg',
                styles.getStarted
              )}
              to={'https://github.com/finos/git-proxy'}>
              GITHUB
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className={styles.members}>
          <div className="container">
            <h2>What is Git Proxy</h2>
            {/* <img align="right" width="550" src="/docs/img/demo.png" alt="Git Proxy Demonstration" /> */}
            <div className="row row--center">Git Proxy deploys custom push protections and policies on top of Git. It is a highly configurable framework allowing developers and organizations to enforce push protections relevant to their developer workflow, security posture and risk appetite.</div>
            <br/>
            <div className="row row--center">Git Proxy is built with a developer-first mindset. By presenting simple-to-follow remediation instructions in the CLI/Terminal, it minimises the friction of use and adoption, and keeps developers focused on what matters; committing and pushing code.</div>
          </div>
        </section>
        {features && features.length && (
          <section className={styles.features}>
            <div className="container">
              <div className="row">
                {features.map((props, idx) => (
                  <Feature key={idx} {...props} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </Layout>
  );
}

export default Home;