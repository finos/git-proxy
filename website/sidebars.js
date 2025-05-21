/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.    
 */
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
