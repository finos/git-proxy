import React from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,  
} from "react-router-dom";

import OpenPushes from './OpenPushes';
import PushDetails from './PushDetails';

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/pushes/:id">
          <PushDetails />
        </Route>
        <Route path="/">
          <OpenPushes />
        </Route>
      </Switch>      
    </Router>
  );
}
