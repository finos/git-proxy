/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Update from '@material-ui/icons/Update';
import Accessibility from '@material-ui/icons/Accessibility';
import Card from '../../../components/Card/Card.jsx';
import CardHeader from '../../../components/Card/CardHeader.jsx';
import CardIcon from '../../../components/Card/CardIcon.jsx';
import CardFooter from '../../../components/Card/CardFooter.jsx';
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle.js';

const useStyles = makeStyles(styles);

export default function SuccessfulPushRequestSummary() {
  const classes = useStyles();
  return (
    <Card>
      <CardHeader color="info" stats icon>
        <CardIcon color="info">
          <Accessibility />
        </CardIcon>
        <p className={classes.cardCategory}>Sucessul Pushes</p>
        <h3 className={classes.cardTitle}>+245</h3>
      </CardHeader>
      <CardFooter stats>
        <div className={classes.stats}>
          <Update />
          Last month
        </div>
      </CardFooter>
    </Card>
  );
}
