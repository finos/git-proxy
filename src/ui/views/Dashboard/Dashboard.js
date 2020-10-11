import React from "react";
import GridItem from "ui/components/Grid/GridItem.js";
import GridContainer from "ui/components/Grid/GridContainer.js";
import OpenPushRequestSummary from "./Components/OpenPushRequestSummary";
import PullRequestSummary from "./Components/PullRequestSummary";
import RejectedPushRequestSummary from "./Components/RejectedPushRequestSummary";
import SuccessfulPushRequestSummary from "./Components/SuccessfulPushRequestSummary";
import DailyPullsGraph from "./Components/DailyPullsGraph";
import RejectedPushGraph from "./Components/RejectedPushGraph";
import PushAuthorizationsGraph from "./Components/PushAuthorizationsGraph";
import PushTable from "./Components/PushTable";
import ContributorsTable from "./Components/ContributorsTable";

export default function Dashboard() {  
  return (
    <div>
      <GridContainer>
        <GridItem xs={12} sm={6} md={3}>
          <OpenPushRequestSummary />
        </GridItem>
        <GridItem xs={12} sm={6} md={3}>
          <PullRequestSummary />
        </GridItem>
        <GridItem xs={12} sm={6} md={3}>
          <RejectedPushRequestSummary />         
        </GridItem>
        <GridItem xs={12} sm={6} md={3}>
         <SuccessfulPushRequestSummary />
        </GridItem>
      </GridContainer>
      <GridContainer>
        <GridItem xs={12} sm={12} md={4}>
          <DailyPullsGraph />
        </GridItem>
        <GridItem xs={12} sm={12} md={4}>
          <PushAuthorizationsGraph />
        </GridItem>
        <GridItem xs={12} sm={12} md={4}>
         <RejectedPushGraph />
        </GridItem>
      </GridContainer>
      <GridContainer>
        <GridItem xs={12} sm={12} md={6}>
          <PushTable />
        </GridItem>
        <GridItem xs={12} sm={12} md={6}>
          <ContributorsTable />
        </GridItem>
      </GridContainer>
    </div>
  );
}
