import React from "react";
import BugReport from "@material-ui/icons/BugReport";
import Code from "@material-ui/icons/Code";
import Table from "ui/components/Table/Table.js";
import CustomTabs from "ui/components/CustomTabs/CustomTabs.js";

export default function PushesWaitingAuthorizationGraph() {
  
  return (  
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
  );
}
