/**
 * @license
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
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

import React, { useState } from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Card from '../Card/Card';
import CardBody from '../Card/CardBody';
import CardHeader from '../Card/CardHeader';
import styles from '../../assets/jss/material-dashboard-react/components/customTabsStyle';
import { SvgIconProps } from '@material-ui/core';

const useStyles = makeStyles(styles as any);

type HeaderColor = 'warning' | 'success' | 'danger' | 'info' | 'primary' | 'rose';

export type TabItem = {
  tabName: string;
  tabIcon?: React.ComponentType<SvgIconProps>;
  tabContent: React.ReactNode;
};

interface CustomTabsProps {
  headerColor?: HeaderColor;
  title?: string;
  tabs: TabItem[];
  rtlActive?: boolean;
  plainTabs?: boolean;
  defaultTab?: number;
}

const CustomTabs: React.FC<CustomTabsProps> = ({
  headerColor = 'primary',
  plainTabs = false,
  tabs,
  title,
  rtlActive = false,
  defaultTab = 0,
}) => {
  const [value, setValue] = useState(defaultTab);
  const classes = useStyles();

  const handleChange = (event: React.ChangeEvent<unknown>, newValue: number) => {
    setValue(newValue);
  };

  const cardTitle = clsx({
    [classes.cardTitle]: true,
    [classes.cardTitleRTL]: rtlActive,
  });

  return (
    <Card plain={plainTabs}>
      <CardHeader color={headerColor} plain={plainTabs}>
        {title !== undefined ? <div className={cardTitle}>{title}</div> : null}
        <Tabs
          value={value}
          onChange={handleChange}
          classes={{
            root: classes.tabsRoot,
            indicator: classes.displayNone,
            scrollButtons: classes.displayNone,
          }}
          variant='scrollable'
          scrollButtons='auto'
        >
          {tabs.map((prop, key) => {
            const icon = prop.tabIcon ? { icon: <prop.tabIcon /> } : {};
            return (
              <Tab
                classes={{
                  root: classes.tabRootButton,
                  selected: classes.tabSelected,
                  wrapper: classes.tabWrapper,
                }}
                key={key}
                label={prop.tabName}
                {...icon}
              />
            );
          })}
        </Tabs>
      </CardHeader>
      <CardBody>
        {tabs.map((prop, key) => (
          <div key={key} style={{ display: key === value ? 'block' : 'none' }}>
            {prop.tabContent}
          </div>
        ))}
      </CardBody>
    </Card>
  );
};

export default CustomTabs;
