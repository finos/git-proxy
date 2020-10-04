import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Table from "ui/components/Table/Table.js";
import Card from "ui/components/Card/Card.js";
import CardHeader from "ui/components/Card/CardHeader.js";
import CardBody from "ui/components/Card/CardBody.js";
import styles from "ui/assets/jss/material-dashboard-react/views/dashboardStyle.js";

const useStyles = makeStyles(styles);

export default function ContributorsTable() {
  const classes = useStyles();
  return (
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
  );
}
