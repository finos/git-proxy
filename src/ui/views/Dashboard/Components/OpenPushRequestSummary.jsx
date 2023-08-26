/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Icon from '@material-ui/core/Icon';
import DateRange from '@material-ui/icons/DateRange';
import Card from '../../../components/Card/Card.jsx';
import CardHeader from '../../../components/Card/CardHeader.jsx';
import CardIcon from '../../..//components/Card/CardIcon.jsx';
import CardFooter from '../../../components/Card/CardFooter.jsx';

import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle.js';

const useStyles = makeStyles(styles);

export default function OpenPushRequestSummary() {
  const classes = useStyles();
  return (
    <Card>
      <CardHeader color="success" stats icon>
        <CardIcon color="success">
          <Icon>content_copy</Icon>
        </CardIcon>
        <p className={classes.cardCategory}>Open Push requests</p>
        <h3 className={classes.cardTitle}>
          23 <small>Pushes</small>
        </h3>
      </CardHeader>
      <CardFooter stats>
        <div className={classes.stats}>
          <DateRange />
          12 older than 1 day
        </div>
      </CardFooter>
    </Card>
  );
}
