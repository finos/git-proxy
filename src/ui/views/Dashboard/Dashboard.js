import React from "react";
// react plugin for creating charts
import ChartistGraph from "react-chartist";
// @material-ui/core
import { makeStyles } from "@material-ui/core/styles";
import Icon from "@material-ui/core/Icon";
// @material-ui/icons
import Store from "@material-ui/icons/Store";
import Warning from "@material-ui/icons/Warning";
import DateRange from "@material-ui/icons/DateRange";
import LocalOffer from "@material-ui/icons/LocalOffer";
import Update from "@material-ui/icons/Update";
import ArrowUpward from "@material-ui/icons/ArrowUpward";
import AccessTime from "@material-ui/icons/AccessTime";
import Accessibility from "@material-ui/icons/Accessibility";
import BugReport from "@material-ui/icons/BugReport";
import Code from "@material-ui/icons/Code";
import Cloud from "@material-ui/icons/Cloud";
// core components
import GridItem from "ui/components/Grid/GridItem.js";
import GridContainer from "ui/components/Grid/GridContainer.js";
import Table from "ui/components/Table/Table.js";
import Tasks from "ui/components/Tasks/Tasks.js";
import CustomTabs from "ui/components/CustomTabs/CustomTabs.js";
import Danger from "ui/components/Typography/Danger.js";
import Card from "ui/components/Card/Card.js";
import CardHeader from "ui/components/Card/CardHeader.js";
import CardIcon from "ui/components/Card/CardIcon.js";
import CardBody from "ui/components/Card/CardBody.js";
import CardFooter from "ui/components/Card/CardFooter.js";

import { bugs, website, server } from "ui/variables/general.js";

import {
  dailySalesChart,
  emailsSubscriptionChart,
  completedTasksChart
} from "ui/variables/charts.js";

import styles from "ui/assets/jss/material-dashboard-react/views/dashboardStyle.js";

const useStyles = makeStyles(styles);

export default function Dashboard() {
  const classes = useStyles();
  return (
    <div>
      <GridContainer>
        <GridItem xs={12} sm={6} md={3}>
          <Card>
            <CardHeader color="warning" stats icon>
              <CardIcon color="warning">
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
        </GridItem>
        <GridItem xs={12} sm={6} md={3}>
          <Card>
            <CardHeader color="success" stats icon>
              <CardIcon color="success">
                <Store />
              </CardIcon>
              <p className={classes.cardCategory}>Open source Pulls</p>
              <h3 className={classes.cardTitle}>1,432</h3>
            </CardHeader>
            <CardFooter stats>
              <div className={classes.stats}>
                <DateRange />
                Last 24 Hours
              </div>
            </CardFooter>
          </Card>
        </GridItem>
        <GridItem xs={12} sm={6} md={3}>
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
        </GridItem>
        <GridItem xs={12} sm={6} md={3}>
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
        </GridItem>
      </GridContainer>
      <GridContainer>
        <GridItem xs={12} sm={12} md={4}>
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
                </span>{" "}
                increase in Git pulls today.
              </p>
            </CardBody>
            <CardFooter chart>
              <div className={classes.stats}>
                <AccessTime /> updated 4 minutes ago
              </div>
            </CardFooter>
          </Card>
        </GridItem>
        <GridItem xs={12} sm={12} md={4}>
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
        </GridItem>
        <GridItem xs={12} sm={12} md={4}>
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
        </GridItem>
      </GridContainer>
      <GridContainer>
        <GridItem xs={12} sm={12} md={6}>
          <CustomTabs
            title="Tasks:"
            headerColor="primary"
            tabs={[
              {
                tabName: "Waiting Authorization",
                tabIcon: Code,
                tabContent: (
                  <Table
                    tableHeaderColor="warning"
                    tableHead={["Name", "provider", "repo", "branch", "message"]}
                    tableData={[
                      ["Dakota Rice", "github", "finos/datahub", "enhance-markov-model", "enhanced analyser"],
                      ["Minerva Hooper", "github", "pgrovesy/git-proxy", "enhance-markov-model", "enhanced analyser"],
                      ["Sage Rodriguez", "github", "finos/datahelix", "datahub-merge", "added documentation"],
                      ["Philip Chaney", "github", "finos/datahub", "master", "quick documentation fix"],
                    ]}
                  />
                )
              },
              {
                tabName: "Rejections",
                tabIcon: BugReport,
                tabContent: (
                  <Table
                    tableHeaderColor="warning"
                    tableHead={["Name", "provider", "repo", "branch", "reason"]}
                    tableData={[
                      ["Dakota Rice", "github", "finos/datahub", "enhance-markov-model", "password discoverd"],
                      ["Minerva Hooper", "github", "pgrovesy/git-proxy", "enhance-markov-model", "bad commit message"],
                    ]}
                  />
                )
              }
            ]}
          />
        </GridItem>
        <GridItem xs={12} sm={12} md={6}>
          <Card>
            <CardHeader color="warning">
              <h4 className={classes.cardTitleWhite}>Developer Stats</h4>
              <p className={classes.cardCategoryWhite}>
                New employees on 15th September, 2016
              </p>
            </CardHeader>
            <CardBody>
              <Table
                tableHeaderColor="warning"
                tableHead={["ID", "Name", "Pushes", "Pushes Authorized", "Pushes Rejected", "Pulls"]}
                tableData={[
                  ["1", "Dakota Rice", "12", "11", "1", "321"],
                  ["2", "Minerva Hooper", "6", "6", "0", "10945"],
                  ["3", "Sage Rodriguez", "4", "1", "3", "127"],
                  ["4", "Philip Chaney", "2", "2", "0", "1956"],
                ]}
              />
            </CardBody>
          </Card>
        </GridItem>
      </GridContainer>
    </div>
  );
}
