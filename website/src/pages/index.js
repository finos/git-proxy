import React from 'react';
import Layout from '@theme/Layout';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Avatar from '../components/avatar';
import Testimonials from './testimonials';
import ReactPlayer from 'react-player';

/**
 * Home page component
 * @return {JSX.Element}
 */
function Home() {
  const context = useDocusaurusContext();
  const { siteConfig = {} } = context;

  const [isReady, setIsReady] = React.useState(false);
  const playerRef = React.useRef();

  const onReady = React.useCallback(() => {
    if (!isReady) {
      const timeToStart = 8 * 60 + 16;
      playerRef.current.seekTo(timeToStart, 'seconds');
      setIsReady(true);
    }
  }, [isReady]);

  const [showDemo, setShowDemo] = React.useState(false);

  return (
    <Layout title={`${siteConfig.title}`} description={`${siteConfig.tagline}`}>
      <div className='hero hero--secondary'>
        <div className='container text--center'>
          <h1 className='hero__title'>Git Proxy v{siteConfig.customFields.version} is out! 🥳</h1>
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
              <ReactPlayer
                url='https://www.finos.org/hubfs/Projects%20%2B%20SIGs/Open%20Source%20Readiness%20OSR/OSR%20Meeting_%20GitProxy%20Jamie%20Slome%20Citi%20Presentation.mp4'
                controls={true}
                width='100%'
                pip={true}
                stopOnUnmount={false}
                ref={playerRef}
                onReady={onReady}
                playing={true}
              />
            </section>
          ) : (
            <section className='terminal'>
              <div className='history'>$ git push</div>
              <br />
              <span className='prompt'>
                You have configured the following push protections and policies:
              </span>
              <br />
              <br />
              <div className='prompt margin-left--lg'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  height='0.9em'
                  viewBox='0 0 640 512'
                  fill='green'
                >
                  <path d='M384 32H512c17.7 0 32 14.3 32 32s-14.3 32-32 32H398.4c-5.2 25.8-22.9 47.1-46.4 57.3V448H512c17.7 0 32 14.3 32 32s-14.3 32-32 32H320 128c-17.7 0-32-14.3-32-32s14.3-32 32-32H288V153.3c-23.5-10.3-41.2-31.6-46.4-57.3H128c-17.7 0-32-14.3-32-32s14.3-32 32-32H256c14.6-19.4 37.8-32 64-32s49.4 12.6 64 32zm55.6 288H584.4L512 195.8 439.6 320zM512 416c-62.9 0-115.2-34-126-78.9c-2.6-11 1-22.3 6.7-32.1l95.2-163.2c5-8.6 14.2-13.8 24.1-13.8s19.1 5.3 24.1 13.8l95.2 163.2c5.7 9.8 9.3 21.1 6.7 32.1C627.2 382 574.9 416 512 416zM126.8 195.8L54.4 320H199.3L126.8 195.8zM.9 337.1c-2.6-11 1-22.3 6.7-32.1l95.2-163.2c5-8.6 14.2-13.8 24.1-13.8s19.1 5.3 24.1 13.8l95.2 163.2c5.7 9.8 9.3 21.1 6.7 32.1C242 382 189.7 416 126.8 416S11.7 382 .9 337.1z' />
                </svg>{' '}
                Apache-2.0, MIT license(s) only
              </div>
              <div className='prompt margin-left--lg margin-top--md'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  height='0.9em'
                  viewBox='0 0 512 512'
                  fill='orange'
                >
                  <path d='M336 352c97.2 0 176-78.8 176-176S433.2 0 336 0S160 78.8 160 176c0 18.7 2.9 36.8 8.3 53.7L7 391c-4.5 4.5-7 10.6-7 17v80c0 13.3 10.7 24 24 24h80c13.3 0 24-10.7 24-24V448h40c13.3 0 24-10.7 24-24V384h40c6.4 0 12.5-2.5 17-7l33.3-33.3c16.9 5.4 35 8.3 53.7 8.3zM376 96a40 40 0 1 1 0 80 40 40 0 1 1 0-80z' />
                </svg>{' '}
                No secrets detected
              </div>
              <div className='prompt margin-left--lg margin-top--md'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  height='0.9em'
                  viewBox='0 0 448 512'
                  fill='gray'
                >
                  <path d='M448 80v48c0 44.2-100.3 80-224 80S0 172.2 0 128V80C0 35.8 100.3 0 224 0S448 35.8 448 80zM393.2 214.7c20.8-7.4 39.9-16.9 54.8-28.6V288c0 44.2-100.3 80-224 80S0 332.2 0 288V186.1c14.9 11.8 34 21.2 54.8 28.6C99.7 230.7 159.5 240 224 240s124.3-9.3 169.2-25.3zM0 346.1c14.9 11.8 34 21.2 54.8 28.6C99.7 390.7 159.5 400 224 400s124.3-9.3 169.2-25.3c20.8-7.4 39.9-16.9 54.8-28.6V432c0 44.2-100.3 80-224 80S0 476.2 0 432V346.1z' />
                </svg>{' '}
                No data files found (.csv, .txt, .log)
              </div>
              <div className='prompt margin-left--lg margin-top--md'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  height='0.9em'
                  viewBox='0 0 512 512'
                  fill='white'
                >
                  <path d='M48 64C21.5 64 0 85.5 0 112c0 15.1 7.1 29.3 19.2 38.4L236.8 313.6c11.4 8.5 27 8.5 38.4 0L492.8 150.4c12.1-9.1 19.2-23.3 19.2-38.4c0-26.5-21.5-48-48-48H48zM0 176V384c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V176L294.4 339.2c-22.8 17.1-54 17.1-76.8 0L0 176z' />
                </svg>{' '}
                <span style={{ color: '#FF033E' }}>
                  Author e-mail address does not match domain
                </span>
              </div>
              <div className='prompt margin-top--lg'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  height='0.8em'
                  viewBox='0 0 512 512'
                  fill='red'
                >
                  <path d='M367.2 412.5L99.5 144.8C77.1 176.1 64 214.5 64 256c0 106 86 192 192 192c41.5 0 79.9-13.1 111.2-35.5zm45.3-45.3C434.9 335.9 448 297.5 448 256c0-106-86-192-192-192c-41.5 0-79.9 13.1-111.2 35.5L412.5 367.2zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256z' />
                </svg>{' '}
                Your push has been blocked...
                <span className='typed-cursor'>&#9608;</span>
              </div>
            </section>
          )}
        </div>
      </div>
      <div className='container text--center margin-top--xl'>
        <h1 className='margin-top--md'>Meet the Team 👋</h1>
        <div className='row margin-top--xl margin-bottom--xl'>
          <div className='col col--4'>
            <div className='col-demo'>
              <Avatar name='Paul Groves' description='Engineering at Citi' username='grovesy' />
            </div>
          </div>
          <div className='col col--4'>
            <div className='col-demo'>
              {' '}
              <Avatar
                name='Jamie Slome'
                description='Open Source Operations at Citi'
                username='JamieSlome'
              />
            </div>
          </div>
          <div className='col col--4'>
            <div className='col-demo'>
              {' '}
              <Avatar name='Maurizio (Mao) Pillitu' description='CTO at FINOS' username='maoo' />
            </div>
          </div>
          <div className='col col--4'>
            <div className='col-demo'>
              {' '}
              <Avatar
                name='Thomas Cooper'
                description='Director, OSS Development at RBC'
                username='coopernetes'
              />
            </div>
          </div>
          <div className='col col--4'>
            <div className='col-demo'>
              {' '}
              <Avatar
                name='Miklos Sagi'
                description='OSPO Engineering Lead at NatWest Group'
                username='msagi'
              />
            </div>
          </div>
        </div>
      </div>
      <Testimonials />
    </Layout>
  );
}

export default Home;
