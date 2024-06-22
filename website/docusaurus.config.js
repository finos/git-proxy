// Docs at https://v2.docusaurus.io/docs/configuration

const projectName = 'GitProxy';

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
    posts: [
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:share:7092203565380722688',
      },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:activity:7181933362339549184',
      },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:activity:7175490880689057792',
      },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:share:7201603784194629633',
      },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:share:7184554793741230080',
      },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:share:7189253601540624385',
      },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:activity:7077564318463995904',
      },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:activity:7189256993470099456',
      },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:activity:7181643315405033472',
      },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:share:7196479535876325377',
      },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:activity:7167196087143899136',
      },
      {
        platform: 'linkedin',
        url: 'https://www.linkedin.com/embed/feed/update/urn:li:activity:7196479537872859137',
      },
    ],
  },
  scripts: ['https://buttons.github.io/buttons.js'],
  stylesheets: ['https://fonts.googleapis.com/css?family=Overpass:400,400i,700'],
  themeConfig: {
    colorMode: {
      disableSwitch: false,
    },
    navbar: {
      logo: {
        alt: 'GitProxy Logo',
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
          'aria-label': 'GitProxy on GitHub',
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
