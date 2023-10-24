module.exports = {
  mainSidebar: [
    'index',
    {
      type: 'category',
      label: 'Get Started',
      link: {
        type: 'generated-index',
        title: 'Get Started',
        slug: '/category/get-started',
        keywords: [
          'get started',
          'quickstart',
          'installation',
          'configuration',
          'usage',
        ],
        image: '/img/github-mark.png',
      },
      collapsible: true,
      collapsed: false,
      items: [
        'get-started/installation',
        'get-started/usage',
        'get-started/configuration',
        'get-started/quickstart',
        'get-started/authorize',
      ],
    },
  ],
};
