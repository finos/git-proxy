/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React from 'react';
import ReactDOM from 'react-dom';
import { createBrowserHistory } from 'history';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';

// core components
import Admin from './ui/layouts/Admin.jsx';
import Login from './ui/views/Login/Login.jsx';
import './ui/assets/css/material-dashboard-react.css';

const hist = createBrowserHistory();

ReactDOM.render(
  <Router history={hist}>
    <Routes>
      <Route exact path='/admin/*' element={<Admin />} />
      <Route exact path='/login' element={<Login />} />
      <Route exact path='/' element={<Navigate from='/' to='/login' />} />
    </Routes>
  </Router>,
  document.getElementById('root'),
);
