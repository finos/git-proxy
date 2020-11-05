/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import Icon from '@material-ui/core/Icon';
import LocalOffer from '@material-ui/icons/LocalOffer';
import Card from '../../../components/Card/Card.js';
import CardHeader from '../../../components/Card/CardHeader.js';
import CardIcon from '../../../components/Card/CardIcon.js';
import CardFooter from '../../../components/Card/CardFooter.js';
import styles from '../../../assets/jss/material-dashboard-react/views/dashboardStyle.js';

const useStyles = makeStyles(styles);

export default function RejectedPushRequestSummary() {
  const classes = useStyles();
  return (
    <Card>
      <CardHeader color="danger" stats icon>
        <CardIcon color="danger">
          <Icon>info_outline</Icon>
        </CardIcon>
        <p className={classes.cardCategory}>Auto Rejected Pushes</p>
        <h3 className={classes.cardTitle}>75</h3>
      </CardHeader>
      <CardFooter stats>
        <div className={classes.stats}>
          <LocalOffer />
          Due to hitting guardrails
        </div>
      </CardFooter>
    </Card>
  );
}
