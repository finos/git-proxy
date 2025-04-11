module.exports = {
  mainSidebar: [
    'index',
    {
      type: 'category',
      label: 'Quickstart',
      link: {
        type: 'generated-index',
        title: 'Quickstart',
        slug: '/category/quickstart',
        keywords: ['get started', 'quickstart'],
        image: '/img/github-mark.png',
      },
      collapsible: true,
      collapsed: false,
      items: ['quickstart/intercept', 'quickstart/approve'],
    },
    'installation',
    'usage',
    {
      type: 'category',
      label: 'Configuration',
      link: {
        type: 'generated-index',
        title: 'Configuration',
        slug: '/category/configuration',
        keywords: ['config', 'configuration'],
        image: '/img/github-mark.png',
      },
      collapsible: true,
      collapsed: false,
      items: ['configuration/overview', 'configuration/reference', 'configuration/pre-receive'],
    },
    {
      type: 'category',
      label: 'Development',
      link: {
        type: 'generated-index',
        title: 'Development',
        slug: '/category/development',
        keywords: ['dev', 'development'],
        image: '/img/github-mark.png',
      },
      collapsible: true,
      collapsed: false,
      items: ['development/contributing', 'development/plugins'],
    },
  ],
};
