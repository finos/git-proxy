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
import TerminalDemo from '../components/terminalDemo';
import Testimonials from './testimonials';
import axios from 'axios';

/**
 * Home page component
 * @return {JSX.Element}
 */
function Home() {
  const context = useDocusaurusContext();
  const { siteConfig = {} } = context;

  const [showDemo, setShowDemo] = React.useState(false);
  const [contributors, setContributors] = React.useState([]);

  useEffect(() => {
    axios.get('https://api.github.com/repos/finos/git-proxy/contributors').then((res) => {
      setContributors(res.data);
    });
  }, []);

  return (
    <Layout title={`${siteConfig.title}`} description={`${siteConfig.tagline}`}>
      <div className='hero hero--secondary'>
        <div className='container text--center'>
          <h1 className='hero__title'>GitProxy v{siteConfig.customFields.version} is out! 🥳</h1>
          <p style={{ fontSize: '20px' }}>{siteConfig.tagline}</p>
          <div className='margin-top--lg'>
            <a
              className='button button--outline button--primary button--lg margin-right--sm'
              href='/docs'
            >
              Read our Docs
            </a>
            <button
              onClick={() => setShowDemo(!showDemo)}
              className='button button--outline button--secondary button--lg margin-left--sm'
            >
              {showDemo ? 'Hide' : 'Watch'} the demo &nbsp;🎬
            </button>
            <a
              className='button button--outline button--secondary button--lg margin-left--sm'
              href='/docs/category/quickstart'
            >
              Quickstart 🚀
            </a>
          </div>
        </div>
      </div>
      <div className='hero hero--secondary'>
        <div className='terminal-window shadow--tl'>
          <header>
            <div className='btn red'></div>
            <div className='btn yellow'></div>
            <div className='btn green'></div>
          </header>
          {showDemo ? (
            <section style={{ background: 'black' }}>
              <video
                controls
                style={{ width: '100%', display: 'block', aspectRatio: '16/9' }}
                preload='metadata'
              >
                <source
                  src='https://www.finos.org/hubfs/Projects%20%2B%20SIGs/Open%20Source%20Readiness%20OSR/OSR%20Meeting_%20GitProxy%20Jamie%20Slome%20Citi%20Presentation.mp4#t=496'
                  type='video/mp4'
                />
                Your browser does not support the video tag.
              </video>
            </section>
          ) : (
            <section className='terminal'>
              <TerminalDemo
                src='/demo/git-push.cast'
                narrowSrc='/demo/git-push-narrow.cast'
                posterAt='0:14'
                label='Terminal recording: a git push containing an AWS access key is blocked by GitProxy with the file and line to fix; after the key is moved to an environment variable, the push is accepted and GitProxy prints a link to request approval.'
              />
            </section>
          )}
        </div>
      </div>
      <Testimonials />
      <div className='container text--center margin-top--xl'>
        <h1 className='margin-top--md'>
          Our{' '}
          <span
            style={{
              color: 'purple',
              border: '2px solid purple',
              paddingTop: '5px',
              paddingBottom: '5px',
              paddingLeft: '10px',
              paddingRight: '10px',
              borderRadius: '30px',
              backgroundColor: 'rgba(90, 34, 139, 0.1)',
            }}
          >
            Maintainers
          </span>
        </h1>
        <div className='row margin-top--xl margin-bottom--xl'>
          <div className='col col--4'>
            <div className='col-demo'>
              {' '}
              <Avatar name='Paul Groves' description='Director at Citi' username='grovesy' />
            </div>
          </div>
          <div className='col col--4'>
            <div className='col-demo'>
              {' '}
              <Avatar name='Jamie Slome' description='Emeritus Maintainer' username='JamieSlome' />
            </div>
          </div>
          <div className='col col--4'>
            <div className='col-demo'>
              {' '}
              <Avatar
                name='Juan Escalada'
                description='Open Source Software Engineer at G-Research'
                username='jescalada'
              />
            </div>
          </div>
        </div>
        <div className='row margin-bottom--xl'>
          <div className='col col--4'>
            <div className='col-demo'>
              <Avatar
                name='Kris West'
                description='Principal Engineer at NatWest Group'
                username='kriswest'
              />
            </div>
          </div>
          <div className='col col--4'>
            <div className='col-demo'>
              <Avatar
                name='Thomas Cooper'
                description='Director, OSS Development at RBC'
                username='coopernetes'
              />
            </div>
          </div>
          <div className='col col--4'>
            <div className='col-demo'>
              <Avatar
                name='Jack Kelly'
                description='Senior Consultant at ControlPlane'
                username='06kellyjac'
              />
            </div>
          </div>
        </div>
        <div className='row margin-bottom--xl'>
          <div className='col col--4'>
            <div className='col-demo'>
              <Avatar
                name='Andy Pols'
                description='Engineer at Qube Research & Technologies'
                username='andypols'
              />
            </div>
          </div>
          <div className='col col--4'>
            <div className='col-demo'>
              <Avatar
                name='Fabio Vincenzi'
                description='Open Source Software Engineer at G-Research'
                username='fabiovincenzi'
              />
            </div>
          </div>
          <div className='col col--4'>
            <div className='col-demo'>
              <Avatar
                name='Denis Coric'
                description='Open Source Software Engineer at G-Research'
                username='dcoric'
              />
            </div>
          </div>
        </div>
      </div>
      <div className='container text--center'>
        <h1 className='margin-top--md'>
          Our{' '}
          <span
            style={{
              color: '#30d5c8',
              border: '2px solid #30d5c8',
              paddingTop: '5px',
              paddingBottom: '5px',
              paddingLeft: '10px',
              paddingRight: '10px',
              borderRadius: '30px',
              backgroundColor: 'rgba(48, 213, 200, 0.1)',
            }}
          >
            Contributors
          </span>
        </h1>
        <div className='row margin-top--xl margin-bottom--xl'>
          {contributors.map((contributor) => {
            if (![29139614, 49699333].includes(contributor.id))
              return (
                <div key={contributor.id} className='col col--4'>
                  <div className='col-demo'>
                    <Avatar
                      name={contributor.login}
                      description={`${contributor.contributions} ${contributor.contributions > 1 ? 'contributions' : 'contribution'}`}
                      username={contributor.login}
                    />
                  </div>
                </div>
              );
          })}
        </div>
      </div>
    </Layout>
  );
}

export default Home;
