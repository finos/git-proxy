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
    'configuration',
  ],
};
