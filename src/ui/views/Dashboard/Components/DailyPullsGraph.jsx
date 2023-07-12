/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import ChartistGraph from 'react-chartist';
import {makeStyles} from '@material-ui/core/styles';
import AccessTime from '@material-ui/icons/AccessTime';
import Card from '../../../components/Card/Card.jsx';
import CardHeader from '../../../components/Card/CardHeader.jsx';
import CardBody from '../../../components/Card/CardBody.jsx';
import CardFooter from '../../../components/Card/CardFooter.jsx';
import ArrowUpward from '@material-ui/icons/ArrowUpward';
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle.js';

import 
  {dailySalesChart} from '../../../variables/charts.js';

const useStyles = makeStyles(styles);

export default function DailyPullsGraph() {
  const classes = useStyles();
  return (
    <Card chart>
      <CardHeader color="success">
        <ChartistGraph
          className="ct-chart"
          data={dailySalesChart.data}
          type="Line"
          options={dailySalesChart.options}
          listener={dailySalesChart.animation}
        />
      </CardHeader>
      <CardBody>
        <h4 className={classes.cardTitle}>Daily Github pulls</h4>
        <p className={classes.cardCategory}>
          <span className={classes.successText}>
            <ArrowUpward className={classes.upArrowCardCategory} /> 55%
          </span>{' '}
          increase in Git pulls today.
        </p>
      </CardBody>
      <CardFooter chart>
        <div className={classes.stats}>
          <AccessTime /> updated 4 minutes ago
        </div>
      </CardFooter>
    </Card>
  );
}
