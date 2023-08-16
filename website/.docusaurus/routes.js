import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '21b'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', 'e2f'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'd06'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', '2fa'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', 'bac'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', 'a61'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', 'daf'),
    exact: true
  },
  {
    path: '/docs',
    component: ComponentCreator('/docs', '945'),
    routes: [
      {
        path: '/docs/home',
        component: ComponentCreator('/docs/home', '0dd'),
        exact: true,
        sidebar: "mainSidebar"
      },
      {
        path: '/docs/roadmap',
        component: ComponentCreator('/docs/roadmap', 'b44'),
        exact: true,
        sidebar: "mainSidebar"
      },
      {
        path: '/docs/team',
        component: ComponentCreator('/docs/team', '335'),
        exact: true,
        sidebar: "mainSidebar"
      }
    ]
  },
  {
    path: '/',
    component: ComponentCreator('/', 'd33'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
