import React from "react";
import GridItem from "ui/components/Grid/GridItem.js";
import GridContainer from "ui/components/Grid/GridContainer.js";
import PushesTable from "./components/PushesTable";

export default function Dashboard() {  
  return (
    <div>
      <GridContainer>
        <GridItem xs={12} sm={12} md={12}>
          <PushesTable />
        </GridItem>
      </GridContainer>
    </div>
  );
}
