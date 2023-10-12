// Docs at https://v2.docusaurus.io/docs/configuration

const projectName = 'Git Proxy';

module.exports = {
  title: `${projectName}`,
  tagline: `Deploy custom push protections and policies on top of Git`,
  url: 'https://git-proxy.finos.org',
  baseUrl: '/',
  favicon: 'img/favicon/favicon-finos.ico',
  projectName: `${projectName}`,
  organizationName: 'FINOS',
  customFields: {
    version: '1.1.0',
  },
  scripts: ['https://buttons.github.io/buttons.js'],
  stylesheets: [
    'https://fonts.googleapis.com/css?family=Overpass:400,400i,700',
  ],
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
    announcementBar: {
      id: 'osff',
      content:
        '<a style="text-decoration: none" href="https://sched.co/1PzH1">Join us at Open Source in Finance Forum (OSFF) on November 1st in New York 🇺🇸</a>',
      backgroundColor: '#3578E5',
      textColor: 'white',
      isCloseable: true,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          editUrl: 'https://github.com/finos/git-proxy/website/',
          sidebarPath: require.resolve('./sidebars.js'),
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
