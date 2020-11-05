/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import ChartistGraph from 'react-chartist';
import {makeStyles} from '@material-ui/core/styles';
import AccessTime from '@material-ui/icons/AccessTime';
import Card from '../../../components/Card/Card.js';
import CardHeader from '../../../components/Card/CardHeader.js';
import CardBody from '../../../components/Card/CardBody.js';
import CardFooter from '../../../components/Card/CardFooter.js';

import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle.js';

import {
  completedTasksChart,
} from '../../../variables/charts.js';

const useStyles = makeStyles(styles);

export default function DailyPullsGraph() {
  const classes = useStyles();
  return (
    <Card chart>
      <CardHeader color="danger">
        <ChartistGraph
          className="ct-chart"
          data={completedTasksChart.data}
          type="Line"
          options={completedTasksChart.options}
          listener={completedTasksChart.animation}
        />
      </CardHeader>
      <CardBody>
        <h4 className={classes.cardTitle}>Push Rjections</h4>
        <p className={classes.cardCategory}>10% reduction in push rejections</p>
      </CardBody>
      <CardFooter chart>
        <div className={classes.stats}>
          <AccessTime /> updated 4 minutes ago
        </div>
      </CardFooter>
    </Card>
  );
}
