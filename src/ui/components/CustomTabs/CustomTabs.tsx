import React, { useState } from 'react';
import clsx from 'clsx';
import { makeStyles } from '@material-ui/core/styles';
import Tabs from '@material-ui/core/Tabs';
import Tab from '@material-ui/core/Tab';
import Card from '../Card/Card';
import CardBody from '../Card/CardBody';
import CardHeader from '../Card/CardHeader';
import styles from '../../assets/jss/material-dashboard-react/components/customTabsStyle';

const useStyles = makeStyles(styles as any);

type HeaderColor = 'warning' | 'success' | 'danger' | 'info' | 'primary' | 'rose';

interface TabItem {
  tabName: string;
  tabIcon?: React.ComponentType;
  tabContent: React.ReactNode;
}

interface CustomTabsProps {
  headerColor?: HeaderColor;
  title?: string;
  tabs: TabItem[];
  rtlActive?: boolean;
  plainTabs?: boolean;
}

const CustomTabs: React.FC<CustomTabsProps> = ({
  headerColor = 'primary',
  plainTabs = false,
  tabs,
  title,
  rtlActive = false,
}) => {
  const [value, setValue] = useState(0);
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
