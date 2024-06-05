// Docs at https://v2.docusaurus.io/docs/configuration

const projectName = 'Git Proxy';

const { version } = require('../package.json');

module.exports = {
  title: `${projectName}`,
  tagline: `Deploy custom push protections and policies on top of Git`,
  url: 'https://git-proxy.finos.org',
  baseUrl: '/',
  favicon: 'img/favicon/favicon-finos.ico',
  projectName: `${projectName}`,
  organizationName: 'FINOS',
  customFields: {
    version,
  },
  scripts: ['https://buttons.github.io/buttons.js'],
  stylesheets: ['https://fonts.googleapis.com/css?family=Overpass:400,400i,700'],
  themeConfig: {
    colorMode: {
      disableSwitch: false,
    },
    navbar: {
      logo: {
        alt: 'Git Proxy Logo',
        src: 'img/logo.png',
        height: 50,
      },
      items: [
        {
          to: 'docs',
          position: 'right',
          className: 'header-read-doc-link',
          'aria-label': 'Read our Docs',
        },
        {
          href: 'https://app.slack.com/client/T01E7QRQH97/C06LXNW0W76',
          position: 'right',
          className: 'header-slack-link',
          'aria-label': 'Join Slack Channel',
        },
        {
          href: 'https://github.com/finos/git-proxy',
          position: 'right',
          className: 'header-star-link',
          'aria-label': 'Star on GitHub',
        },
        {
          href: 'https://github.com/finos/git-proxy/fork',
          position: 'right',
          className: 'header-fork-link',
          'aria-label': 'Fork on GitHub',
        },
        {
          href: 'https://github.com/finos/git-proxy',
          position: 'right',
          className: 'header-github-link',
          'aria-label': 'Git Proxy on GitHub',
        },
      ],
    },
    footer: {
      logo: {
        alt: 'Fintech Open Source Foundation',
        src: 'img/finos/finos-blue.png',
        srcDark: 'img/finos/finos-white.png',
        href: 'https://finos.org',
        height: 50,
      },
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          editUrl: 'https://github.com/finos/git-proxy/edit/main/website/',
          sidebarPath: require.resolve('./sidebars.js'),
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
