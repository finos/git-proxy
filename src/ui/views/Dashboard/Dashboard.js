/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import GridItem from '../../components/Grid/GridItem.js';
import GridContainer from '../../components/Grid/GridContainer.js';
import OpenPushRequestSummary from './Components/OpenPushRequestSummary';
import CancelledPushRequestSummary from './Components/CancelledPushRequestSummary';
// import PushRequestSummary from './Components/PushRequestSummary';
// import PullRequestSummary from './Components/PullRequestSummary';
import RejectedPushRequestSummary from './Components/RejectedPushRequestSummary';
import SuccessfulPushRequestSummary from './Components/SuccessfulPushRequestSummary';
// import DailyPullsGraph from './Components/DailyPullsGraph';
// import RejectedPushGraph from './Components/RejectedPushGraph';
// import PushAuthorizationsGraph from './Components/PushAuthorizationsGraph';
// import PushTable from './Components/PushTable';
// import ContributorsTable from './Components/ContributorsTable';

export default function Dashboard() {
  return (
    <div>
      <GridContainer>
        <GridItem xs={12} sm={6} md={2}>
          <OpenPushRequestSummary />
        </GridItem>
        <GridItem xs={12} sm={6} md={2}>
          <CancelledPushRequestSummary />
        </GridItem>
        <GridItem xs={12} sm={6} md={2}>
          <RejectedPushRequestSummary />
        </GridItem>
        <GridItem xs={12} sm={6} md={2}>
          <SuccessfulPushRequestSummary />
        </GridItem>
      </GridContainer>
    </div>
  );
}
