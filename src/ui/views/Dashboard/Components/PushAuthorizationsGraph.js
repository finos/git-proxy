import React from "react";
import ChartistGraph from "react-chartist";
import { makeStyles } from "@material-ui/core/styles";
import AccessTime from "@material-ui/icons/AccessTime";
import Card from "ui/components/Card/Card.js";
import CardHeader from "ui/components/Card/CardHeader.js";
import CardBody from "ui/components/Card/CardBody.js";
import CardFooter from "ui/components/Card/CardFooter.js";

import {
  emailsSubscriptionChart,  
} from "ui/variables/charts.js";

import styles from "ui/assets/jss/material-dashboard-react/views/dashboardStyle.js";

const useStyles = makeStyles(styles);


export default function PushAuthorizationsGraph() {
  const classes = useStyles();
  return (
    <Card chart>
      <CardHeader color="warning">
        <ChartistGraph
          className="ct-chart"
          data={emailsSubscriptionChart.data}
          type="Bar"
          options={emailsSubscriptionChart.options}
          responsiveOptions={emailsSubscriptionChart.responsiveOptions}
          listener={emailsSubscriptionChart.animation}
        />
      </CardHeader>
      <CardBody>
        <h4 className={classes.cardTitle}>Push Authorizations</h4>
        <p className={classes.cardCategory}>20% increase in git-pushes waiting authorization</p>
      </CardBody>
      <CardFooter chart>
        <div className={classes.stats}>
          <AccessTime /> updated 4 minutes ago
        </div>
      </CardFooter>
    </Card>
  );
}
