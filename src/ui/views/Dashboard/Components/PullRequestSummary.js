import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Icon from "@material-ui/core/Icon";
import LocalOffer from "@material-ui/icons/LocalOffer";
import Card from "ui/components/Card/Card.js";
import CardHeader from "ui/components/Card/CardHeader.js";
import CardIcon from "ui/components/Card/CardIcon.js";
import CardFooter from "ui/components/Card/CardFooter.js";
import styles from "ui/assets/jss/material-dashboard-react/views/dashboardStyle.js";

const useStyles = makeStyles(styles);

export default function PullRequestSummary() {
  const classes = useStyles();
  return (
    <Card>
      <CardHeader color="success" stats icon>
        <CardIcon color="success">
          <Icon>info_outline</Icon>
        </CardIcon>
        <p className={classes.cardCategory}>Pull Requests</p>
        <h3 className={classes.cardTitle}>3275</h3>
      </CardHeader>
      <CardFooter stats>
        <div className={classes.stats}>
          <LocalOffer />
          Pull requests from open-source repositories
        </div>
      </CardFooter>
    </Card>        
  );
}
