/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import ReactDOM from 'react-dom';
import {createBrowserHistory} from 'history';
import {Router, Route, Switch, Redirect} from 'react-router-dom';

// core components
import Admin from './ui/layouts/Admin.js';
import Login from './ui/views/Login/Login.js';
import './ui/assets/css/material-dashboard-react.css';

const hist = createBrowserHistory();
const renderFn = (element)=>{
  if (window.sessionStorage.getItem('git.proxy.login')==null) {
    return <Redirect to="/login"/>;
  } else {
    return element;
  }
};

ReactDOM.render(
    <Router history={hist}>
      <Switch>
        <Route path="/admin" render={()=>renderFn(<Admin />)} />
        <Route path="/login" component={Login} />
        <Redirect from="/" to="/admin/dashboard" />
      </Switch>
    </Router>,
    document.getElementById('root'),
);
